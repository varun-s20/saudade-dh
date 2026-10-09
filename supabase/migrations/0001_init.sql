-- ════════════════════════════════════════════════════════════════════════════
-- SAUDADE · migration 0001 · initial schema (Supabase Postgres)
--
-- Generated from db/schema.sql (the design source of truth; rationale in docs/ARCHITECTURE.md §5)
-- with the Supabase-specific changes recorded in DECISIONS D-075:
--   - citext lives in Supabase's `extensions` schema.
--   - admin passwords: scrypt (Node built-in) or argon2id PHC strings.
--   - No custom roles: the app connects server-side as the database owner through the pooler.
--   - Every table has Row Level Security ON with NO policies, and all privileges are revoked from
--     Supabase's `anon` / `authenticated` roles, so the public Data API (PostgREST) exposes nothing.
--     Views run as the invoker so they cannot side-step that.
-- Applied by scripts/db-setup.mjs inside one transaction.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists citext with schema extensions;

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type unit_status as enum ('unassigned', 'assigned', 'claimed', 'filled', 'sealed', 'revealed');
create type delivery_path as enum ('A', 'B');
create type stamp_kind as enum ('photos', 'letter', 'voice', 'song');
create type media_kind as enum ('photo', 'voice');
create type media_state as enum ('awaiting_upload', 'uploaded', 'processing', 'ready', 'rejected', 'removed');
create type actor_kind as enum ('sender', 'recipient', 'admin', 'system');
create type batch_status as enum ('generated', 'encoded', 'void');
create type reveal_outcome as enum (
  'revealed',         -- the first open: consumed the ceremony
  'duplicate',        -- already revealed (idempotent repeat)
  'not_revealable',   -- not sealed yet (or nothing inside): nothing consumed
  'sender_excluded',  -- request carried a valid sender token for this unit (sender testing their tap)
  'admin_excluded',   -- request carried an admin session (packing / support check)
  'bot_ignored',      -- user agent on the link-preview denylist (backstop only)
  'reset'             -- admin "reset reveal" marker
);
create type token_origin as enum ('claim', 'recover', 'admin');
create type email_template as enum ('sender_link', 'recover_link', 'gift_code');
create type email_status as enum ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');
create type job_state as enum ('queued', 'running', 'done', 'dead');

-- ─── Helpers ────────────────────────────────────────────────────────────────

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

-- ─── Admin ──────────────────────────────────────────────────────────────────

create table admin_users (
  id                    uuid primary key default gen_random_uuid(),
  email                 extensions.citext not null unique check (char_length(email) <= 254),
  display_name          text check (char_length(display_name) <= 80),
  -- PHC-style string: $scrypt$ln=15,r=8,p=1$<salt>$<hash> (Node's built-in scrypt), or $argon2id$… .
  password_hash         text not null check (password_hash ~ '^\$(argon2id|scrypt)\$'),
  -- [PROPOSED 2FA] RFC 6238 TOTP secret, AES-256-GCM encrypted with TOTP_ENC_KEY (env, not DB):
  -- 12-byte nonce || ciphertext || 16-byte tag. Null until the admin enrols.
  totp_secret_enc       bytea check (totp_secret_enc is null or octet_length(totp_secret_enc) between 40 and 128),
  totp_enrolled_at      timestamptz,
  -- Highest 30 s time-step accepted so far: a code can never be replayed.
  totp_last_used_step   bigint,
  -- SHA-256 of single-use recovery codes (10 issued at enrolment).
  recovery_code_hashes  bytea[] not null default '{}',
  failed_sign_ins       smallint not null default 0 check (failed_sign_ins >= 0),
  locked_until          timestamptz,
  last_sign_in_at       timestamptz,
  created_at            timestamptz not null default now(),
  disabled_at           timestamptz,
  constraint admin_users_totp_ck check ((totp_secret_enc is null) = (totp_enrolled_at is null))
);
comment on table admin_users is 'Zeya + developer. Created by CLI only (no sign-up). 2FA columns are [PROPOSED] pending client approval.';

create table admin_sessions (
  -- SHA-256 of the 256-bit random cookie value (__Host-saudade_admin). The raw id is never stored.
  id_hash        bytea primary key check (octet_length(id_hash) = 32),
  admin_id       uuid not null references admin_users (id),
  mfa_verified   boolean not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- 12 h idle / 7 d absolute; enforced in app, expires_at is the absolute cap.
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  user_agent     text check (char_length(user_agent) <= 400),
  ip_hash        bytea check (ip_hash is null or octet_length(ip_hash) = 32)
);
create index admin_sessions_admin_idx on admin_sessions (admin_id) where revoked_at is null;
comment on table admin_sessions is 'Server-side admin sessions; delete rows older than 30 days (job).';

-- ─── Provisioning ───────────────────────────────────────────────────────────

create table batches (
  id            uuid primary key default gen_random_uuid(),
  label         text not null check (char_length(label) between 1 and 80),
  status        batch_status not null default 'generated',
  unit_count    integer not null check (unit_count between 1 and 5000),
  -- Characters after the SAUD- prefix (4 = SAUD-XXXX, 8 = SAUD-XXXX-XXXX). See O9.
  code_length   smallint not null check (code_length in (4, 8)),
  -- The domain encoded on the chips of this batch (O2). Permanent once status = 'encoded'.
  chip_domain   text not null check (chip_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  created_by    uuid references admin_users (id),
  created_at    timestamptz not null default now(),
  encoded_at    timestamptz,
  voided_at     timestamptz,
  notes         text check (char_length(notes) <= 2000),
  constraint batches_encoded_ck check (status <> 'encoded' or encoded_at is not null),
  constraint batches_void_ck check (status <> 'void' or voided_at is not null)
);
comment on table batches is
  'One provisioning ceremony. Plaintext codes exist only in the generation response/CSV; a lost CSV '
  'before encoding => void the batch and regenerate. Never void an encoded batch.';

-- ─── Units ──────────────────────────────────────────────────────────────────

create table units (
  id                  uuid primary key default gen_random_uuid(),
  -- Human packing label (printed "S-0042" on the code card and the base sticker). NOT a secret,
  -- grants nothing; exists so cards are packed with the right ceramic.
  unit_no             integer generated always as identity unique,
  batch_id            uuid not null references batches (id),
  -- NFC slug: 12 chars RFC 4648 base32 lower-case (60 bits). Encoded on the chip as
  -- https://{chip_domain}/t/{slug}. Stored in clear: it is on the chip and must be re-exportable.
  slug                text not null unique check (slug ~ '^[a-z2-7]{12}$'),
  -- HMAC-SHA-256(CODE_PEPPER_v{code_key_version}, 'saudade/code/v1:' || normalised body).
  -- Deterministic so it can be looked up by index; the pepper lives in env, never in the DB,
  -- so a database dump cannot be brute-forced and a CSV of codes can never be re-exported.
  code_hash           bytea not null unique check (octet_length(code_hash) = 32),
  code_key_version    smallint not null default 1 check (code_key_version >= 1),
  code_issued_at      timestamptz not null default now(),
  -- Null = the current code can still be claimed. Set on claim; cleared when admin resets/emails a code.
  code_redeemed_at    timestamptz,
  status              unit_status not null default 'unassigned',
  delivery_path       delivery_path,
  sender_email        extensions.citext check (sender_email is null or (char_length(sender_email) <= 254 and sender_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  claimed_at          timestamptz,
  sealed_at           timestamptz,
  revealed_at         timestamptz,
  code_emailed_at     timestamptz,
  code_emailed_to     extensions.citext check (code_emailed_to is null or char_length(code_emailed_to) <= 254),
  -- Max(updated_at) of the current contents: drives "new" postmarks and admin sorting.
  content_updated_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint units_claimed_ck  check (status in ('unassigned', 'assigned') or claimed_at is not null),
  constraint units_sealed_ck   check (status <> 'sealed' or sealed_at is not null),
  constraint units_revealed_ck check ((status = 'revealed') = (revealed_at is not null)),
  constraint units_path_b_ck   check (code_emailed_at is null or delivery_path = 'B')
);
create index units_status_idx on units (status);
create index units_batch_idx on units (batch_id, unit_no);
create index units_sender_email_idx on units (sender_email) where sender_email is not null;
create index units_code_emailed_to_idx on units (code_emailed_to) where code_emailed_to is not null;
create index units_updated_idx on units (updated_at desc);
create trigger units_touch before update on units for each row execute function touch_updated_at();
comment on table units is
  'One ceramic envelope. Lifecycle unassigned → assigned → claimed ⇄ filled → sealed → revealed '
  '(ARCHITECTURE.md §4). Rows are never deleted.';
comment on column units.status is
  'Content lifecycle. Independent of code_redeemed_at: an admin code reset keeps status, contents and seal.';

-- Sender edit links. Several may be active per unit (claim, each /recover); admin reset revokes all.
create table sender_tokens (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references units (id),
  -- SHA-256 of the 32-char base32 token (160 bits). The raw token exists only in the sender's link.
  token_hash      bytea not null unique check (octet_length(token_hash) = 32),
  origin          token_origin not null,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text check (revoked_reason in ('code_reset', 'admin', 'superseded'))
);
create index sender_tokens_active_idx on sender_tokens (unit_id) where revoked_at is null;
comment on table sender_tokens is 'At most 5 active per unit (oldest revoked as superseded). Hash lookup on every sender API call.';

-- ─── Content (the four stamps), versioned ───────────────────────────────────

create table contents (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units (id),
  kind          stamp_kind not null,
  version       integer not null check (version >= 1),
  -- The StampContent JSON (PhotosContent | LetterContent | VoiceContent | SongContent),
  -- validated by the API (zod) before insert. Never contains media bytes, only media ids.
  payload       jsonb not null check (
                  jsonb_typeof(payload) = 'object'
                  and payload ->> 'kind' = kind::text
                  and octet_length(payload::text) <= 65536),
  saved_by      actor_kind not null default 'sender',
  created_at    timestamptz not null default now(),
  -- Set when a newer version is saved. The head (current) row has superseded_at null.
  superseded_at timestamptz,
  -- Set when the sender/admin removes the stamp; the row stays as history.
  removed_at    timestamptz,
  removed_by    actor_kind,
  unique (unit_id, kind, version),
  constraint contents_removed_ck check ((removed_at is null) = (removed_by is null))
);
-- Exactly one head per (unit, kind). Save = supersede head + insert version+1, in one transaction.
create unique index contents_head_uq on contents (unit_id, kind) where superseded_at is null;
comment on table contents is
  'Every save is a new version; old versions are kept (recoverable by admin). Current = head row with removed_at null.';

create view current_contents as
  select unit_id, kind, version, payload, created_at as updated_at
  from contents
  where superseded_at is null and removed_at is null;
comment on view current_contents is 'What the sender portal and the recipient page show (ContentMap).';

-- ─── Media (photos, voice) ──────────────────────────────────────────────────

create table media (
  -- Capability id: 'med_' + 26 base32 chars (130 bits). Appears only inside contents the holder
  -- of a slug/token can already read; /api/media/{id} 404s once removed.
  id                text primary key check (id ~ '^med_[a-z2-7]{26}$'),
  unit_id           uuid not null references units (id),
  kind              media_kind not null,
  state             media_state not null default 'awaiting_upload',
  declared_mime     text not null check (char_length(declared_mime) <= 100),
  declared_bytes    bigint not null check (declared_bytes > 0 and declared_bytes <= 31457280),
  -- From magic bytes, after upload.
  detected_mime     text check (char_length(detected_mime) <= 100),
  -- R2 key of the raw upload: incoming/{unit_id}/{media_id}. Deleted by R2 lifecycle 7 days after
  -- processing (originals may carry EXIF/GPS; only normalised variants are kept long-term).
  original_key      text not null unique,
  original_bytes    bigint check (original_bytes is null or original_bytes > 0),
  original_sha256   bytea check (original_sha256 is null or octet_length(original_sha256) = 32),
  width             integer check (width is null or width between 1 and 20000),
  height            integer check (height is null or height between 1 and 20000),
  -- Voice cap 3:00 (+0.5 s tolerance).
  duration_ms       integer check (duration_ms is null or duration_ms between 1 and 180500),
  rejection_reason  text check (char_length(rejection_reason) <= 200),
  created_at        timestamptz not null default now(),
  uploaded_at       timestamptz,
  ready_at          timestamptz,
  removed_at        timestamptz,
  removed_by        actor_kind,
  -- removed_at + 90 days. The purge job deletes R2 objects after this, never before.
  purge_after       timestamptz,
  purged_at         timestamptz,
  constraint media_ready_ck check (state <> 'ready' or ready_at is not null),
  constraint media_removed_ck check ((state = 'removed') = (removed_at is not null)),
  constraint media_purge_ck check (removed_at is null or purge_after is not null)
);
create index media_unit_idx on media (unit_id, created_at);
create index media_purge_idx on media (purge_after) where purged_at is null and purge_after is not null;
create index media_pending_idx on media (created_at) where state in ('awaiting_upload', 'uploaded', 'processing');

-- Normalised, immutable derivatives. A reprocess writes version+1 under a NEW key (no overwrites:
-- R2 has no object versioning, so immutability is enforced by the app + an R2 bucket lock rule).
create table media_variants (
  media_id     text not null references media (id),
  variant      text not null check (variant in ('display', 'thumb', 'audio')),
  version      smallint not null default 1 check (version >= 1),
  -- media/{unit_id}/{media_id}/v{version}/{variant}.{ext}
  r2_key       text not null unique,
  mime         text not null check (mime in ('image/jpeg', 'image/webp', 'audio/mp4')),
  bytes        bigint not null check (bytes > 0),
  width        integer,
  height       integer,
  duration_ms  integer,
  created_at   timestamptz not null default now(),
  primary key (media_id, variant, version)
);

-- Which media each content version references (GC + integrity; payload holds the same ids).
create table content_media (
  content_id  uuid not null references contents (id),
  media_id    text not null references media (id),
  primary key (content_id, media_id)
);
create index content_media_media_idx on content_media (media_id);

-- ─── Reveal (first-open integrity) ──────────────────────────────────────────

create table reveal_events (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references units (id),
  outcome          reveal_outcome not null,
  skipped          boolean,
  reduced_motion   boolean,
  user_agent       text check (char_length(user_agent) <= 400),
  ua_flagged_bot   boolean not null default false,
  -- HMAC(IP_HASH_KEY, ip) for abuse correlation only; nulled after 90 days (job).
  ip_hash          bytea check (ip_hash is null or octet_length(ip_hash) = 32),
  idempotency_key  text check (char_length(idempotency_key) <= 64),
  at               timestamptz not null default now(),
  unique (unit_id, idempotency_key)
);
create index reveal_events_unit_idx on reveal_events (unit_id, at desc);
create index reveal_events_recent_idx on reveal_events (at desc) where outcome = 'revealed';
comment on table reveal_events is
  'GET /t/{slug} never writes here. Only POST /api/t/{slug}/reveal (after the choreography) and admin reset.';

-- ─── Audit (append-only) ────────────────────────────────────────────────────

create table audit_log (
  id          bigint generated always as identity primary key,
  unit_id     uuid references units (id),
  -- e.g. unit.claimed, unit.code_reset, content.saved, admin.signed_in (AuditAction in types.ts + additions)
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$' and char_length(action) <= 48),
  actor       actor_kind not null,
  admin_id    uuid references admin_users (id),
  -- Never put codes, tokens, links or message bodies here.
  detail      jsonb not null default '{}'::jsonb check (octet_length(detail::text) <= 4096),
  request_id  text check (char_length(request_id) <= 64),
  at          timestamptz not null default now(),
  constraint audit_admin_ck check (actor <> 'admin' or admin_id is not null or action = 'admin.sign_in_failed')
);
create index audit_unit_idx on audit_log (unit_id, at desc);
create index audit_at_idx on audit_log (at desc);
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function forbid_mutation();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function forbid_mutation();

-- ─── Email ──────────────────────────────────────────────────────────────────

create table email_log (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid references units (id),
  template             email_template not null,
  to_email             extensions.citext not null check (char_length(to_email) <= 254),
  subject              text not null check (char_length(subject) <= 200),
  -- The body is NOT stored: it carries a private link or an activation code.
  provider             text not null default 'resend',
  provider_message_id  text,
  status               email_status not null default 'queued',
  error                text check (char_length(error) <= 500),
  created_at           timestamptz not null default now(),
  sent_at              timestamptz
);
create index email_log_unit_idx on email_log (unit_id, created_at desc);
create index email_log_to_idx on email_log (to_email);
comment on table email_log is 'Delivery log for the admin outbox. Retain 13 months, then pseudonymise to_email (job).';

-- ─── Songs (graceful degradation) ───────────────────────────────────────────

create table song_catalog (
  provider          text not null check (provider in ('spotify', 'apple')),
  track_id          text not null check (char_length(track_id) <= 40),
  title             text not null check (char_length(title) <= 200),
  artist            text not null default '' check (char_length(artist) <= 200),
  artwork_url       text check (char_length(artwork_url) <= 500),
  available         boolean not null default true,
  unavailable_since timestamptz,
  last_checked_at   timestamptz not null default now(),
  primary key (provider, track_id)
);
comment on table song_catalog is
  'One row per distinct track in any envelope; a daily job re-checks oEmbed / iTunes Lookup so a removed '
  'track renders as a labelled vinyl with title + artist instead of a broken embed.';

-- ─── Background jobs (durable queue for media processing etc.) ──────────────

create table jobs (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('media.process', 'media.purge', 'song.check', 'email.send')),
  payload       jsonb not null default '{}'::jsonb,
  state         job_state not null default 'queued',
  attempts      smallint not null default 0,
  max_attempts  smallint not null default 5,
  run_after     timestamptz not null default now(),
  locked_at     timestamptz,
  last_error    text check (char_length(last_error) <= 1000),
  dedupe_key    text unique,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
-- Workers: select … where state = 'queued' and run_after <= now() order by run_after
--          for update skip locked limit N.
create index jobs_ready_idx on jobs (run_after) where state = 'queued';
create index jobs_stuck_idx on jobs (locked_at) where state = 'running';

-- ─── Rate limiting (business limits; coarse per-IP floods are stopped by Vercel WAF) ──

create table rate_limit_buckets (
  -- '{rule}:{subject}:{window_start_epoch}', subject = HMAC(IP_HASH_KEY, ip) or email hash or 'global'.
  key             text primary key check (char_length(key) <= 200),
  window_start    timestamptz not null,
  window_seconds  integer not null check (window_seconds between 1 and 86400),
  count           integer not null default 0 check (count >= 0),
  expires_at      timestamptz not null
);
create index rate_limit_expiry_idx on rate_limit_buckets (expires_at);
comment on table rate_limit_buckets is
  'Fixed-window counters: insert … on conflict (key) do update set count = count + 1 returning count. '
  'Expired rows deleted hourly. Logged (not UNLOGGED): Neon computes restart on scale-to-zero.';

-- Idempotency for retried POSTs. response_body is NULL for scopes that return secrets
-- (batch generation, code emails): those replay as 409 instead of re-sending plaintext.
create table idempotency_keys (
  scope            text not null check (char_length(scope) <= 40),
  key              text not null check (char_length(key) between 8 and 64),
  request_sha256   bytea not null check (octet_length(request_sha256) = 32),
  response_status  smallint,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  primary key (scope, key)
);
create index idempotency_created_idx on idempotency_keys (created_at);

-- ─── Admin read model ───────────────────────────────────────────────────────

create view unit_overview as
  select
    u.id, u.unit_no, u.batch_id, u.slug, u.status, u.delivery_path, u.sender_email,
    u.claimed_at, u.sealed_at, u.revealed_at, u.code_emailed_at, u.code_emailed_to,
    u.code_redeemed_at is null as code_claimable,
    u.content_updated_at, u.created_at, u.updated_at,
    coalesce(array_agg(c.kind order by c.kind) filter (where c.kind is not null), '{}') as filled_kinds
  from units u
  left join current_contents c on c.unit_id = u.id
  group by u.id;
comment on view unit_overview is 'Admin units table. Codes are never selectable in clear; the API shows SAUD-····.';


-- ─── Lock the public Data API out of everything (Supabase) ──────────────────
alter view current_contents set (security_invoker = true);
alter view unit_overview set (security_invoker = true);

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
    alter default privileges in schema public revoke all on sequences from anon;
    alter default privileges in schema public revoke all on functions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
    alter default privileges in schema public revoke all on sequences from authenticated;
    alter default privileges in schema public revoke all on functions from authenticated;
  end if;
end $$;
