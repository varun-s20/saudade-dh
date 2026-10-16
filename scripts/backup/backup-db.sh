#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# SAUDADE · nightly logical backup of the database (docs/BACKUPS.md)
#
#   BACKUP_DATABASE_URL=postgresql://… BACKUP_AGE_RECIPIENT=age1… bash scripts/backup/backup-db.sh
#
# Env:
#   BACKUP_DATABASE_URL   Supabase SESSION pooler (or direct) connection string, port 5432.
#                         The transaction pooler (6543) cannot run pg_dump.
#   BACKUP_AGE_RECIPIENT  age public key (age1…). The private key is offline only.
#   OUT_DIR               Where to write the results (default ./backup-out).
#
# Writes to OUT_DIR:
#   saudade-<UTC yyyymmdd-HHMMSS>.dump.age   pg_dump -Fc of schema `public`, encrypted with age
#   manifest.json                             versions, migrations, exact row counts and row checksums
#                                             per table, and the encrypted file's name, size and sha256
#
# Consistency: one REPEATABLE READ transaction exports its snapshot, pg_dump runs on that snapshot
# (--snapshot), and the row counts are taken in the same transaction. The counts in the manifest are
# therefore exactly the rows in the dump, even if the app writes while the backup runs. The restore
# drill (restore-drill.sh) checks every table against them.
#
# The unencrypted dump only ever exists in a private temp directory that is deleted on exit.
# Needs: psql, pg_dump and pg_restore (major version >= the server's), age, sha256sum (or shasum).
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
umask 077
# A write to psql after it died must fail as an error we can report, not kill the script silently.
trap '' PIPE

log() { printf '%s backup-db: %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ─── Inputs ─────────────────────────────────────────────────────────────────
DB_URL=${BACKUP_DATABASE_URL:-}
RECIPIENT=${BACKUP_AGE_RECIPIENT:-}
OUT_DIR=${OUT_DIR:-./backup-out}

[[ -n $DB_URL ]] || die "BACKUP_DATABASE_URL is not set (Supabase → Connect → Session pooler URI, port 5432)"
[[ -n $RECIPIENT ]] || die "BACKUP_AGE_RECIPIENT is not set (the age public key, age1…)"
[[ $RECIPIENT =~ ^age1[0-9a-z]+$ ]] || die "BACKUP_AGE_RECIPIENT does not look like an age public key (age1…)"
if [[ $DB_URL =~ :6543(/|\?|$) ]]; then
  die "BACKUP_DATABASE_URL uses port 6543 (transaction pooler); pg_dump needs the session pooler or a direct connection on 5432"
fi

for tool in psql pg_dump pg_restore age; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed or not on PATH"
done
if command -v sha256sum >/dev/null 2>&1; then
  sha256_of() { local out; out=$(sha256sum "$1") || return 1; printf '%s\n' "${out%% *}"; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_of() { local out; out=$(shasum -a 256 "$1") || return 1; printf '%s\n' "${out%% *}"; }
else
  die "sha256sum (or shasum) is not installed"
fi

export PGAPPNAME=saudade-backup
export PGCONNECT_TIMEOUT=${PGCONNECT_TIMEOUT:-30}

mkdir -p "$OUT_DIR"
work=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/saudade-backup.XXXXXX") || die "could not create a temp directory"
psql_pid=""
cleanup() {
  local rc=$?
  if [[ -n $psql_pid ]]; then kill "$psql_pid" 2>/dev/null || true; fi
  rm -rf "$work"
  rm -f "$OUT_DIR"/*.partial 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ─── 1. Open the snapshot transaction (kept open until the counts are taken) ─
# psql runs as a coprocess: we send SQL on its stdin and read rows (unaligned, tuples only) back.
coproc SNAPSHOT_PSQL { exec psql -d "$DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 -P pager=off 2>"$work/psql.err"; }
psql_pid=$SNAPSHOT_PSQL_PID
exec {sql_in}>&"${SNAPSHOT_PSQL[1]}" {sql_out}<&"${SNAPSHOT_PSQL[0]}"

psql_failed() {
  local detail
  detail=$(tr '\n' ' ' <"$work/psql.err" 2>/dev/null | cut -c1-400)
  die "$1${detail:+: $detail}"
}

# ask TIMEOUT_SECONDS SQL… : sends the statements and reads the output lines into ROWS.
ask() {
  local timeout=$1 line; shift
  ROWS=()
  printf '%s\n' "$@" "select '__end__';" >&"$sql_in" 2>/dev/null || return 1
  while IFS= read -r -t "$timeout" line <&"$sql_out"; do
    line=${line%$'\r'}
    [[ $line == "__end__" ]] && return 0
    ROWS+=("$line")
  done
  return 1
}

log "connecting to the database"
# Fixed output settings: the row checksums below must come out identical in the restore drill.
ask 60 \
  "set timezone to 'UTC';" \
  "set datestyle to 'ISO, YMD';" \
  "set intervalstyle to 'postgres';" \
  "set bytea_output to 'hex';" \
  "set extra_float_digits to 1;" \
  "set statement_timeout to 0;" \
  "set idle_in_transaction_session_timeout to 0;" \
  "begin transaction isolation level repeatable read, read only;" \
  "select current_setting('server_version_num');" \
  "select current_setting('server_version');" \
  "select current_database();" \
  "select to_char(now() at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"');" \
  "select to_regclass('public.schema_migrations') is not null;" \
  "select pg_export_snapshot();" \
  || psql_failed "could not connect or open the snapshot transaction"
((${#ROWS[@]} == 6)) || die "unexpected reply while opening the snapshot (${#ROWS[@]} lines)"
server_version_num=${ROWS[0]}
server_version=${ROWS[1]}
database=${ROWS[2]}
created_at=${ROWS[3]}
has_migrations=${ROWS[4]}
snapshot=${ROWS[5]}
[[ $server_version_num =~ ^[0-9]+$ ]] || die "could not read the server version"
[[ $has_migrations == t ]] || die "table public.schema_migrations not found in database '$database': is BACKUP_DATABASE_URL the Saudade database?"
[[ $snapshot =~ ^[0-9A-Fa-f-]+$ ]] || die "could not export a snapshot"

pg_dump_version=$(pg_dump --version)
pg_dump_major=$(sed -E 's/^pg_dump \(PostgreSQL\) ([0-9]+).*/\1/' <<<"$pg_dump_version")
server_major=$((server_version_num / 10000))
[[ $pg_dump_major =~ ^[0-9]+$ ]] || die "could not parse the pg_dump version: $pg_dump_version"
((pg_dump_major >= server_major)) || die "pg_dump $pg_dump_major is older than the server ($server_version); install PostgreSQL $server_major+ client tools"
log "server PostgreSQL $server_version, database '$database', $pg_dump_version, snapshot at $created_at"

stamp="${created_at:0:4}${created_at:5:2}${created_at:8:2}-${created_at:11:2}${created_at:14:2}${created_at:17:2}"
name="saudade-$stamp.dump.age"
plain="$work/saudade-$stamp.dump"
encrypted="$OUT_DIR/$name"

# ─── 2. pg_dump on the exported snapshot ────────────────────────────────────
# Only `public` (the app's schema). Supabase's own schemas (auth, storage, extensions…) are not ours;
# `citext` lives in `extensions` and the restore creates it first. Owners and grants are left out:
# they are Supabase-specific and the restore target has its own roles.
log "dumping schema public"
dump_started=$SECONDS
pg_dump -d "$DB_URL" -Fc --no-owner --no-privileges --schema=public \
  --snapshot="$snapshot" --lock-wait-timeout=120s -f "$plain" \
  || die "pg_dump failed"
log "dump finished in $((SECONDS - dump_started)) s"

# ─── 3. Exact row counts and row checksums, in the same snapshot ────────────
# checksum = sum over rows of the first 60 bits of md5(row as text): order-independent, streams.
log "counting rows in the dump's snapshot"
ask 1800 \
  "select x.n || ' ' || x.h || ' ' || x.t from (
     select p.tablename as t,
            (xpath('/row/n/text()', p.r))[1]::text as n,
            (xpath('/row/h/text()', p.r))[1]::text as h
       from (select tablename,
                    query_to_xml(format('select count(*) as n, coalesce(sum((''x'' || substr(md5(tbl::text), 1, 15))::bit(60)::bigint), 0) as h from public.%I tbl', tablename), false, true, '') as r
               from pg_tables where schemaname = 'public') p
   ) x order by x.t;" \
  || psql_failed "counting rows failed"
table_rows=("${ROWS[@]}")
((${#table_rows[@]} > 0)) || die "schema public has no tables"

ask 120 "select version from public.schema_migrations order by 1;" || psql_failed "reading schema_migrations failed"
migrations=("${ROWS[@]}")
((${#migrations[@]} > 0)) || die "schema_migrations is empty"

printf '%s\n' "commit;" '\q' >&"$sql_in" 2>/dev/null || true
exec {sql_in}>&- {sql_out}<&-
wait "$psql_pid" 2>/dev/null || true
psql_pid=""

# ─── 4. Check the archive contains data for every table ─────────────────────
pg_restore --list "$plain" >"$work/toc.txt" || die "pg_restore cannot read the dump"
total_rows=0
for row in "${table_rows[@]}"; do
  read -r n h t <<<"$row"
  [[ $n =~ ^[0-9]+$ && $h =~ ^[0-9]+$ && -n $t ]] || die "unexpected row count line: $row"
  grep -qF " TABLE DATA public $t " "$work/toc.txt" || die "the dump has no data entry for table $t"
  total_rows=$((total_rows + n))
done
log "dump checked: ${#table_rows[@]} tables, $total_rows rows, migrations ${migrations[*]}"

# ─── 5. Encrypt, then delete the plain dump ─────────────────────────────────
log "encrypting with age"
age -r "$RECIPIENT" -o "$encrypted.partial" "$plain" || die "age encryption failed"
rm -f "$plain"
IFS= read -r header <"$encrypted.partial" || true
[[ $header == "age-encryption.org/v1" ]] || die "the encrypted file has no age header"
mv -f "$encrypted.partial" "$encrypted"
bytes=$(($(wc -c <"$encrypted")))
sha256=$(sha256_of "$encrypted") || die "sha256 failed"
[[ $sha256 =~ ^[0-9a-f]{64}$ ]] || die "could not compute the sha256 of $encrypted"

# ─── 6. manifest.json ───────────────────────────────────────────────────────
json_str() {
  local s=$1
  s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\t'/\\t}; s=${s//$'\r'/}; s=${s//$'\n'/\\n}
  printf '"%s"' "$s"
}
join_lines() { local IFS=$'\n'; printf '%s' "$*" | sed '$!s/$/,/'; }

migration_lines=() count_lines=() checksum_lines=()
for v in "${migrations[@]}"; do migration_lines+=("    $(json_str "$v")"); done
for row in "${table_rows[@]}"; do
  read -r n h t <<<"$row"
  count_lines+=("    $(json_str "$t"): $n")
  checksum_lines+=("    $(json_str "$t"): \"$h\"")
done

manifest="$OUT_DIR/manifest.json"
{
  printf '{\n'
  printf '  "format": "saudade-db-backup/1",\n'
  printf '  "created_at": %s,\n' "$(json_str "$created_at")"
  printf '  "database": %s,\n' "$(json_str "$database")"
  printf '  "schema": "public",\n'
  printf '  "server_version": %s,\n' "$(json_str "$server_version")"
  printf '  "server_version_num": %s,\n' "$server_version_num"
  printf '  "pg_dump_version": %s,\n' "$(json_str "$pg_dump_version")"
  printf '  "pg_dump_options": "-Fc --no-owner --no-privileges --schema=public --snapshot",\n'
  printf '  "migrations": [\n%s\n  ],\n' "$(join_lines "${migration_lines[@]}")"
  printf '  "row_counts": {\n%s\n  },\n' "$(join_lines "${count_lines[@]}")"
  printf '  "row_checksums": {\n%s\n  },\n' "$(join_lines "${checksum_lines[@]}")"
  printf '  "total_rows": %s,\n' "$total_rows"
  printf '  "file": {\n'
  printf '    "name": %s,\n' "$(json_str "$name")"
  printf '    "bytes": %s,\n' "$bytes"
  printf '    "sha256": "%s"\n' "$sha256"
  printf '  },\n'
  printf '  "encryption": { "tool": "age", "recipient": %s }\n' "$(json_str "$RECIPIENT")"
  printf '}\n'
} >"$manifest.partial"
mv -f "$manifest.partial" "$manifest"

if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  {
    echo "dump_file=$encrypted"
    echo "dump_name=$name"
    echo "manifest_file=$manifest"
    echo "stamp=$stamp"
  } >>"$GITHUB_OUTPUT"
fi

log "wrote $encrypted ($bytes bytes, sha256 $sha256)"
log "wrote $manifest"
log "done: ${#table_rows[@]} tables, $total_rows rows"
