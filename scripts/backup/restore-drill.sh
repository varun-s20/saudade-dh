#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# SAUDADE · restore drill (quarterly; ARCHITECTURE.md §10.2, docs/BACKUPS.md §5)
#
#   bash scripts/backup/restore-drill.sh \
#     --dump saudade-20261016-023012.dump.age \
#     --manifest saudade-20261016-023012.manifest.json \
#     --identity ~/saudade-backup-key.txt \
#     --target postgresql://postgres@localhost:5432/restore_drill_20261016 | tee drill-report.md
#
# Run by a person, on their own machine, with the OFFLINE age private key. It:
#   1. refuses to touch a target database that already has anything in schema `public`;
#   2. checks the dump's size and sha256 against the manifest;
#   3. decrypts to a private temp file (deleted on exit) and restores it in one transaction
#      (pg_restore --no-owner --no-privileges --exit-on-error --single-transaction);
#   4. verifies: same tables, every row count and row checksum equal to the manifest,
#      schema_migrations equal, the audit_log append-only triggers present and refusing changes,
#      identity sequences ahead of the data, RLS on every table;
#   5. prints a PASS/FAIL report (Markdown, on stdout) to paste into docs/OPS_LOG.md.
#
# The same script is the real restore in a disaster (into a NEW, empty database): docs/BACKUPS.md §7.
# Exit: 0 PASS · 1 FAIL · 2 refused (bad arguments, target not empty, missing tools).
# Needs: bash 4+, psql + pg_restore (major >= the pg_dump that made the dump), age, sha256sum/shasum.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
umask 077

log() { printf '%s restore-drill: %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
refuse() { log "REFUSED: $*"; exit 2; }

if ((BASH_VERSINFO[0] < 4)); then
  echo "restore-drill: needs bash 4 or newer (macOS: brew install bash)" >&2
  exit 2
fi

usage() {
  sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

DUMP="" MANIFEST="" IDENTITY="" TARGET=""
while (($#)); do
  case $1 in
    --dump) DUMP=${2:-}; shift 2 ;;
    --manifest) MANIFEST=${2:-}; shift 2 ;;
    --identity) IDENTITY=${2:-}; shift 2 ;;
    --target) TARGET=${2:-}; shift 2 ;;
    -h | --help) usage ;;
    *) log "unknown argument: $1"; usage ;;
  esac
done
[[ -n $DUMP && -n $MANIFEST && -n $IDENTITY && -n $TARGET ]] || usage
[[ -f $DUMP ]] || refuse "dump not found: $DUMP"
[[ -f $MANIFEST ]] || refuse "manifest not found: $MANIFEST"
[[ -f $IDENTITY ]] || refuse "age identity (private key) file not found: $IDENTITY"

for tool in psql pg_restore age; do
  command -v "$tool" >/dev/null 2>&1 || refuse "$tool is not installed or not on PATH"
done
if command -v sha256sum >/dev/null 2>&1; then
  sha256_of() { local out; out=$(sha256sum "$1") || return 1; printf '%s\n' "${out%% *}"; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_of() { local out; out=$(shasum -a 256 "$1") || return 1; printf '%s\n' "${out%% *}"; }
else
  refuse "sha256sum (or shasum) is not installed"
fi

now_ms() {
  if [[ -n ${EPOCHREALTIME:-} ]]; then
    local t=${EPOCHREALTIME/[.,]/}
    printf '%s\n' $((10#$t / 1000))
  else
    printf '%s\n' $(($(date +%s) * 1000))
  fi
}
secs() { awk -v ms="$1" 'BEGIN { printf "%.1f s", ms / 1000 }'; }

export PGAPPNAME=saudade-restore-drill
export PGCONNECT_TIMEOUT=${PGCONNECT_TIMEOUT:-30}

work=$(mktemp -d "${TMPDIR:-/tmp}/saudade-drill.XXXXXX") || refuse "could not create a temp directory"
cleanup() { rm -rf "$work"; }
trap cleanup EXIT
trap 'exit 130' INT TERM

# q: run SQL from stdin on the target, unaligned, tuples only, stop on the first error.
# (tr: psql on Windows ends lines with CRLF.)
q() { psql -d "$TARGET" -X -q -A -t -v ON_ERROR_STOP=1 -P pager=off "$@" | tr -d '\r'; }
first_error() { grep -m1 -E 'ERROR|FATAL|error' "$1" 2>/dev/null | cut -c1-300 | tr '|' '/' || true; }

started=$(now_ms)

# ─── The manifest goes into SQL as a dollar-quoted literal (no jq needed) ───
manifest_json=$(<"$MANIFEST")
TAG='$saudade_manifest$'
[[ $manifest_json != *"$TAG"* ]] || refuse "the manifest contains $TAG"
M_CTE="with m as (select ${TAG}${manifest_json}${TAG}::json as j)"
US=$'\x1f'

# ─── Report ─────────────────────────────────────────────────────────────────
CHECKS=() FAILED=0
check() { # check NAME PASS|FAIL DETAIL
  local detail=${3//|//}
  CHECKS+=("| $1 | $2 | ${detail//$'\n'/ } |")
  [[ $2 == PASS ]] || FAILED=1
  log "$2 · $1${3:+ · $3}"
}
t_decrypt="" t_restore="" t_verify=""
target_desc="(not reached)" dump_desc="$(basename "$DUMP")" source_desc=""

report() {
  local total result
  total=$(secs $(($(now_ms) - started)))
  result=PASS
  ((FAILED == 0)) || result=FAIL
  cat <<EOF
### Restore drill · $(date -u +'%Y-%m-%d %H:%M UTC')

| | |
| --- | --- |
| Backup | \`$dump_desc\` |
| Taken from | $source_desc |
| Restored into | $target_desc |
| Restored with | $(pg_restore --version), $(age --version 2>/dev/null | head -1 | sed 's/^/age /') |

| Check | Result | Detail |
| --- | --- | --- |
$(printf '%s\n' "${CHECKS[@]}")

**Result: $result** · total $total (decrypt ${t_decrypt:-n/a}, restore ${t_restore:-n/a}, verify ${t_verify:-n/a})
EOF
  if ((FAILED)); then
    echo
    echo "The target database was left as it is for inspection. Drop it when done."
  fi
}
finish() { report; ((FAILED == 0)) && exit 0 || exit 1; }

# ─── 1. Target: reachable, EMPTY; read the manifest ─────────────────────────
log "reading the manifest and checking the target database"
if ! q >"$work/pre.out" 2>"$work/pre.err" <<SQL
$M_CTE
select concat_ws(chr(31),
  current_database(),
  coalesce(host(inet_server_addr()) || ':' || inet_server_port()::text, 'local socket'),
  current_setting('server_version'),
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')),
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'),
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'),
  (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and (t.typtype in ('e', 'd', 'r', 'm') or (t.typtype = 'b' and t.typcategory <> 'A'))),
  coalesce(j->>'format', ''),
  coalesce(j->>'created_at', ''),
  coalesce(j->'file'->>'name', ''),
  coalesce(j->'file'->>'bytes', ''),
  coalesce(j->'file'->>'sha256', ''),
  coalesce(j->>'pg_dump_version', ''),
  coalesce(j->>'server_version', ''),
  coalesce(j->>'database', ''))
from m;
SQL
then
  err=$(first_error "$work/pre.err")
  if grep -q 'json' "$work/pre.err"; then refuse "the manifest is not valid JSON: $err"; fi
  refuse "cannot query the target database: ${err:-$(head -c 300 "$work/pre.err")}"
fi
IFS=$US read -r t_db t_addr t_version n_tables n_rel n_func n_types m_format m_created m_name m_bytes m_sha m_pgdump m_server m_database <"$work/pre.out"
target_desc="\`$t_db\` on PostgreSQL $t_version ($t_addr)"
source_desc="\`$m_database\` on PostgreSQL $m_server at $m_created, $m_pgdump"
[[ $m_format == saudade-db-backup/1 ]] || refuse "$MANIFEST is not a Saudade backup manifest (format '$m_format')"

if ((n_tables > 0 || n_rel > 0 || n_func > 0 || n_types > 0)); then
  refuse "target database '$t_db' is not empty: schema public has $n_tables tables, $n_rel relations, $n_func functions, $n_types types. Restore only into a NEW, EMPTY database (e.g. createdb restore_drill_$(date -u +%Y%m%d))."
fi
log "target '$t_db' ($t_addr, PostgreSQL $t_version) is empty"

# pg_restore cannot read archives written by a newer pg_dump.
dump_major=$(sed -nE 's/^pg_dump \(PostgreSQL\) ([0-9]+).*/\1/p' <<<"$m_pgdump")
restore_major=$(pg_restore --version | sed -nE 's/^pg_restore \(PostgreSQL\) ([0-9]+).*/\1/p')
if [[ -n $dump_major && -n $restore_major ]] && ((restore_major < dump_major)); then
  refuse "this dump was made by pg_dump $dump_major; pg_restore $restore_major cannot read it. Install PostgreSQL $dump_major client tools."
fi

# ─── 2. The dump is the file the manifest describes ─────────────────────────
actual_bytes=$(($(wc -c <"$DUMP")))
actual_sha=$(sha256_of "$DUMP") || refuse "sha256 failed"
dump_desc="$(basename "$DUMP") ($actual_bytes bytes)"
if [[ $actual_sha == "$m_sha" && $actual_bytes == "$m_bytes" ]]; then
  check "Dump matches manifest (size, sha256)" PASS "sha256 ${actual_sha:0:12}…"
else
  check "Dump matches manifest (size, sha256)" FAIL "manifest: $m_name, $m_bytes bytes, ${m_sha:0:12}…; file: $actual_bytes bytes, ${actual_sha:0:12}…"
  finish
fi

# ─── 3. Decrypt (to a private temp file, deleted on exit) ───────────────────
plain="$work/restore.dump"
t0=$(now_ms)
if age -d -i "$IDENTITY" -o "$plain" "$DUMP" 2>"$work/age.err"; then
  t_decrypt=$(secs $(($(now_ms) - t0)))
  check "Decrypt with the offline key" PASS "$t_decrypt"
else
  check "Decrypt with the offline key" FAIL "$(head -c 300 "$work/age.err")"
  finish
fi

# ─── 4. Prepare what the dump needs but does not contain ────────────────────
# - `pg_dump --schema=public` writes CREATE SCHEMA public, which fails on any database that already has
#   one: that TOC entry (and its comment) is skipped.
# - citext lives in Supabase's `extensions` schema; the dump refers to extensions.citext.
# - Roles: owners and privileges are skipped (--no-owner --no-privileges), so `anon`/`authenticated` are
#   only needed if the dump has row-level-security POLICIES naming them. Created only in that case.
if ! pg_restore --list "$plain" >"$work/toc.full" 2>"$work/toc.err"; then
  check "Read the archive" FAIL "$(first_error "$work/toc.err")"
  finish
fi
grep -v -E '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public |COMMENT - SCHEMA public )' "$work/toc.full" >"$work/toc.list"

roles_sql=""
if grep -qE '^[0-9]+; [0-9]+ [0-9]+ POLICY ' "$work/toc.list"; then
  log "the dump has RLS policies: creating Supabase roles anon/authenticated/service_role if missing"
  roles_sql="do \$\$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  end \$\$;"
else
  log "roles: none needed (no policies in the dump; owners and privileges are skipped)"
fi

if ! q >"$work/prep.out" 2>"$work/prep.err" <<SQL
create schema if not exists extensions;
create extension if not exists citext with schema extensions;
$roles_sql
select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'citext';
SQL
then
  check "Prepare (extensions schema, citext)" FAIL "$(first_error "$work/prep.err")"
  finish
fi
[[ $(<"$work/prep.out") == extensions ]] || {
  check "Prepare (extensions schema, citext)" FAIL "citext is installed in schema '$(<"$work/prep.out")', the dump needs it in 'extensions'"
  finish
}

# ─── 5. Restore, in one transaction ─────────────────────────────────────────
log "restoring (one transaction)"
t0=$(now_ms)
if pg_restore --no-owner --no-privileges --exit-on-error --single-transaction \
  -L "$work/toc.list" -d "$TARGET" "$plain" 2>"$work/restore.err"; then
  t_restore=$(secs $(($(now_ms) - t0)))
  check "Restore (pg_restore, one transaction)" PASS "$t_restore"
else
  t_restore=$(secs $(($(now_ms) - t0)))
  check "Restore (pg_restore, one transaction)" FAIL "$(first_error "$work/restore.err")"
  finish
fi
rm -f "$plain"

# ─── 6. Verify ──────────────────────────────────────────────────────────────
log "verifying"
t0=$(now_ms)

# Same session settings and checksum expression as backup-db.sh: they must match exactly.
SESSION="set timezone to 'UTC'; set datestyle to 'ISO, YMD'; set intervalstyle to 'postgres'; set bytea_output to 'hex'; set extra_float_digits to 1;"

# 6a. Tables, row counts, row checksums.
if q >"$work/tables.out" 2>"$work/tables.err" <<SQL
$SESSION
$M_CTE,
expected as (
  select c.key as t, c.value as n, h.value as h
  from m
  cross join lateral json_each_text(m.j->'row_counts') c
  left join lateral json_each_text(m.j->'row_checksums') h on h.key = c.key
),
actual as (
  select p.tablename as t,
         (xpath('/row/n/text()', p.r))[1]::text as n,
         (xpath('/row/h/text()', p.r))[1]::text as h
  from (select tablename,
               query_to_xml(format('select count(*) as n, coalesce(sum((''x'' || substr(md5(tbl::text), 1, 15))::bit(60)::bigint), 0) as h from public.%I tbl', tablename), false, true, '') as r
          from pg_tables where schemaname = 'public') p
)
select concat_ws(chr(31), coalesce(e.t, a.t), coalesce(e.n, '-'), coalesce(a.n, '-'), coalesce(e.h, '-'), coalesce(a.h, '-'))
from expected e full join actual a on a.t = e.t
order by 1;
SQL
then
  missing=() extra=() bad_counts=() bad_sums=() n_ok=0 n_tables=0 n_rows=0 sums_known=1
  while IFS=$US read -r t en an eh ah; do
    [[ -n $t ]] || continue
    ((++n_tables))
    if [[ $an == - ]]; then missing+=("$t"); continue; fi
    if [[ $en == - ]]; then extra+=("$t"); continue; fi
    n_rows=$((n_rows + an))
    if [[ $en != "$an" ]]; then bad_counts+=("$t: restored $an, manifest $en"); else ((++n_ok)); fi
    if [[ $eh == - ]]; then sums_known=0; elif [[ $eh != "$ah" ]]; then bad_sums+=("$t"); fi
  done <"$work/tables.out"

  if ((${#missing[@]} == 0 && ${#extra[@]} == 0)); then
    check "Tables = manifest" PASS "$n_tables tables"
  else
    check "Tables = manifest" FAIL "missing: ${missing[*]:-none}; not in manifest: ${extra[*]:-none}"
  fi
  if ((${#bad_counts[@]} == 0 && n_ok > 0)); then
    check "Row counts = manifest" PASS "$n_ok/$n_tables tables, $n_rows rows"
  else
    check "Row counts = manifest" FAIL "$(IFS=';'; echo "${bad_counts[*]:-no tables compared}" | cut -c1-400)"
  fi
  if ((sums_known == 0)); then
    check "Row contents = manifest checksums" FAIL "the manifest has no row_checksums"
  elif ((${#bad_sums[@]} == 0)); then
    check "Row contents = manifest checksums" PASS "every row of $n_ok tables identical"
  else
    check "Row contents = manifest checksums" FAIL "different: ${bad_sums[*]}"
  fi
else
  check "Tables and row counts = manifest" FAIL "$(first_error "$work/tables.err")"
fi

# 6b. schema_migrations.
if q >"$work/mig.out" 2>"$work/mig.err" <<SQL
$M_CTE
select concat_ws(chr(31),
  (select coalesce(string_agg(version, ', ' order by version), '') from public.schema_migrations),
  (select coalesce(string_agg(v, ', ' order by v), '') from m, json_array_elements_text(m.j->'migrations') v));
SQL
then
  IFS=$US read -r mig_restored mig_manifest <"$work/mig.out"
  if [[ -n $mig_manifest && $mig_restored == "$mig_manifest" ]]; then
    check "schema_migrations = manifest" PASS "$mig_restored"
  else
    check "schema_migrations = manifest" FAIL "restored: ${mig_restored:-none}; manifest: ${mig_manifest:-none}"
  fi
else
  check "schema_migrations = manifest" FAIL "$(first_error "$work/mig.err")"
fi

# 6c. audit_log is append-only: both triggers present and enabled, and they really refuse.
#     The probe runs in a transaction that is rolled back; a TRUNCATE that got through would abort it.
audit_ok=1 audit_detail=""
triggers=$(q 2>"$work/trg.err" <<'SQL' || echo "__error__"
select coalesce(string_agg(tgname, ', ' order by tgname), '')
from pg_trigger
where tgrelid = to_regclass('public.audit_log')
  and tgname in ('audit_log_append_only', 'audit_log_no_truncate')
  and tgenabled <> 'D';
SQL
)
if [[ $triggers != "audit_log_append_only, audit_log_no_truncate" ]]; then
  audit_ok=0
  audit_detail="enabled triggers: ${triggers:-none} $(first_error "$work/trg.err")"
elif q >"$work/probe.out" 2>"$work/probe.err" <<'SQL'
begin;
do $$
declare
  refused boolean;
  probe bigint;
begin
  refused := false;
  begin
    truncate public.audit_log;
  exception when insufficient_privilege then
    refused := sqlerrm like '%append-only%';
  end;
  if not refused then raise exception 'audit_log accepted TRUNCATE'; end if;

  select min(id) into probe from public.audit_log;
  if probe is not null then
    refused := false;
    begin
      update public.audit_log set action = action where id = probe;
    exception when insufficient_privilege then
      refused := sqlerrm like '%append-only%';
    end;
    if not refused then raise exception 'audit_log accepted UPDATE'; end if;
    refused := false;
    begin
      delete from public.audit_log where id = probe;
    exception when insufficient_privilege then
      refused := sqlerrm like '%append-only%';
    end;
    if not refused then raise exception 'audit_log accepted DELETE'; end if;
  end if;
end $$;
select case when exists (select 1 from public.audit_log) then 'UPDATE, DELETE and TRUNCATE refused'
            else 'TRUNCATE refused (no rows to probe UPDATE/DELETE)' end;
rollback;
SQL
then
  audit_detail="triggers enabled; $(<"$work/probe.out")"
else
  audit_ok=0
  audit_detail=$(first_error "$work/probe.err")
fi
if ((audit_ok)); then
  check "audit_log append-only" PASS "$audit_detail"
else
  check "audit_log append-only" FAIL "$audit_detail"
fi

# 6d. Identity/serial sequences are ahead of the data (the restored database can take new rows).
if q >"$work/seq.out" 2>"$work/seq.err" <<'SQL'
select concat_ws(chr(31), s.col, coalesce(s.last::text, '0'), coalesce(s.maxv, '0'))
from (
  select format('%s.%s', c.relname, a.attname) as col,
         pg_sequence_last_value(pg_get_serial_sequence(format('public.%I', c.relname), a.attname)::regclass) as last,
         (xpath('/row/v/text()', query_to_xml(format('select max(%I) as v from public.%I', a.attname, c.relname), false, true, '')))[1]::text as maxv
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
    and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null
) s
order by 1;
SQL
then
  seq_bad=() seq_n=0
  while IFS=$US read -r col last maxv; do
    [[ -n $col ]] || continue
    ((++seq_n))
    ((last >= maxv)) || seq_bad+=("$col: sequence $last < max $maxv")
  done <"$work/seq.out"
  if ((${#seq_bad[@]} == 0)); then
    check "Identity sequences ahead of the data" PASS "$seq_n sequences"
  else
    check "Identity sequences ahead of the data" FAIL "${seq_bad[*]}"
  fi
else
  check "Identity sequences ahead of the data" FAIL "$(first_error "$work/seq.err")"
fi

# 6e. Supabase lock-down survived: RLS on every table, views run as the invoker.
if q >"$work/rls.out" 2>"$work/rls.err" <<'SQL'
select concat_ws(chr(31),
  count(*) filter (where c.relkind in ('r', 'p')),
  coalesce(string_agg(c.relname, ', ' order by c.relname) filter (where c.relkind in ('r', 'p') and not c.relrowsecurity), ''),
  count(*) filter (where c.relkind = 'v'),
  coalesce(string_agg(c.relname, ', ' order by c.relname)
    filter (where c.relkind = 'v' and coalesce(array_to_string(c.reloptions, ',') !~ 'security_invoker=(true|on|1|yes)', true)), ''))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v');
SQL
then
  IFS=$US read -r rls_tables no_rls rls_views no_invoker <"$work/rls.out"
  if [[ -z $no_rls && -z $no_invoker ]]; then
    check "RLS on every table, views security_invoker" PASS "$rls_tables tables, $rls_views views"
  else
    check "RLS on every table, views security_invoker" FAIL "no RLS: ${no_rls:-none}; not security_invoker: ${no_invoker:-none}"
  fi
else
  check "RLS on every table, views security_invoker" FAIL "$(first_error "$work/rls.err")"
fi

t_verify=$(secs $(($(now_ms) - t0)))
finish
