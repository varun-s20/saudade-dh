-- ════════════════════════════════════════════════════════════════════════════
-- SAUDADE · migration 0002 · scheduled jobs bookkeeping (DECISIONS D-083)
--
--   ops_runs                  when each scheduled task last ran and how it went, so the admin's
--                             launch checklist can say "the nightly jobs are running".
--   media.original_deleted_at the raw upload (incoming/…) was deleted after its normalised files
--                             had been kept for 7 days (ARCHITECTURE.md §5.2): only the variants
--                             (no metadata) are kept long-term.
-- Applied by scripts/db-setup.mjs inside one transaction; additive only.
-- ════════════════════════════════════════════════════════════════════════════

create table ops_runs (
  task              text primary key check (task ~ '^[a-z_.]+$' and char_length(task) <= 40),
  last_started_at   timestamptz not null,
  last_finished_at  timestamptz,
  last_ok           boolean,
  -- Counts only (what was checked, purged, retried…). Never ids, emails, codes or links.
  last_summary      jsonb not null default '{}'::jsonb check (octet_length(last_summary::text) <= 4096),
  last_error        text check (char_length(last_error) <= 1000)
);
comment on table ops_runs is 'One row per scheduled task (cron.daily, cron.jobs): last run, outcome, counts.';

alter table media add column original_deleted_at timestamptz;
comment on column media.original_deleted_at is
  'Set when the raw upload was deleted (7 days after normalisation). The variants in media_variants remain.';

-- Same lock-down as every other table (0001): the public Data API sees nothing.
alter table ops_runs enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on ops_runs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on ops_runs from authenticated;
  end if;
end $$;
