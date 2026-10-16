/**
 * Scheduled work (ARCHITECTURE.md §5.2 retention, §6.6 ops, §10.5). Called by the cron routes in
 * app/api/cron/*; every step is idempotent and bounded, so a run that stops at its deadline just
 * carries on next time.
 *
 * Media lifecycle, in order:
 *   1. uploads never completed (24 h)              → rejected, any partial object deleted
 *   2. ready media no current stamp uses (7 days)  → soft-removed: recoverable for 90 days
 *   3. soft-removed past its 90 days               → files deleted for good (row kept, purged_at)
 *   4. raw uploads 7 days after normalising        → deleted; the metadata-free variants remain
 *   5. ready media never normalised (older uploads, a failed fast path) → a `media.process` job
 */
import "server-only";
import type postgres from "postgres";
import { sql } from "./db";
import { enqueue, runDueJobs, type JobHandlers, type JobRunSummary } from "./jobs";
import { processMediaJob, VARIANT_VERSION } from "./media-jobs";
import { checkSongs } from "./songs";
import { removeObjects } from "./storage";

export const JOB_HANDLERS: JobHandlers = { "media.process": processMediaJob };

export type OpsTask = "cron.daily" | "cron.jobs" | "backup.nightly";

/** Record a run of a scheduled task in ops_runs (counts only, never personal data). */
export async function recordRun(task: OpsTask, startedAt: Date, ok: boolean, summary: Record<string, unknown>, error?: string): Promise<void> {
  await sql()`
    insert into ops_runs (task, last_started_at, last_finished_at, last_ok, last_summary, last_error)
    values (${task}, ${startedAt}, now(), ${ok}, ${sql().json(summary as postgres.JSONValue)}, ${error?.slice(0, 1000) ?? null})
    on conflict (task) do update set last_started_at = excluded.last_started_at, last_finished_at = excluded.last_finished_at,
      last_ok = excluded.last_ok, last_summary = excluded.last_summary, last_error = excluded.last_error`;
}

export function runJobs(deadlineMs: number): Promise<JobRunSummary> {
  return runDueJobs(JOB_HANDLERS, { max: 200, deadlineMs });
}

// ─── Media housekeeping ──────────────────────────────────────────────────────

/** Media referenced by a stamp someone can see right now. */
const IN_CURRENT_USE = `
  exists (select 1 from content_media cm join contents c on c.id = cm.content_id
          where cm.media_id = m.id and c.superseded_at is null and c.removed_at is null)`;

async function rejectStaleUploads(): Promise<number> {
  const rows = await sql()<{ original_key: string }[]>`
    update media set state = 'rejected', rejection_reason = 'upload never completed'
    where state in ('awaiting_upload', 'uploaded') and created_at < now() - interval '24 hours'
    returning original_key`;
  if (rows.length) await removeObjects(rows.map((r) => r.original_key));
  return rows.length;
}

async function sweepOrphans(): Promise<number> {
  const rows = await sql().unsafe(`
    update media m set state = 'removed', removed_at = now(), removed_by = 'system', purge_after = now() + interval '90 days'
    where m.state = 'ready' and m.created_at < now() - interval '7 days' and not ${IN_CURRENT_USE}
    returning m.id`);
  return rows.length;
}

async function purgeExpired(deadlineMs: number): Promise<number> {
  let purged = 0;
  while (Date.now() < deadlineMs) {
    const batch = await sql().unsafe<{ id: string; keys: string[] }[]>(`
      select m.id,
             array_remove(array_append(coalesce(array_agg(v.r2_key) filter (where v.r2_key is not null), '{}'),
                                       case when m.original_deleted_at is null then m.original_key end), null) as keys
      from media m left join media_variants v on v.media_id = m.id
      where m.state = 'removed' and m.purged_at is null and m.purge_after < now() and not ${IN_CURRENT_USE}
      group by m.id limit 100`);
    if (!batch.length) break;
    await removeObjects(batch.flatMap((b) => b.keys));
    await sql()`update media set purged_at = now() where id = any(${batch.map((b) => b.id)})`;
    purged += batch.length;
  }
  return purged;
}

async function deleteProcessedOriginals(deadlineMs: number): Promise<number> {
  let deleted = 0;
  while (Date.now() < deadlineMs) {
    // Only once every variant of the current pipeline version exists (photo: display + thumb; voice: audio).
    const rows = await sql()<{ id: string; original_key: string }[]>`
      select m.id, m.original_key from media m
      where m.state = 'ready' and m.original_deleted_at is null and m.ready_at < now() - interval '7 days'
        and (select count(*) from media_variants v where v.media_id = m.id and v.version = ${VARIANT_VERSION})
            >= case when m.kind = 'photo' then 2 else 1 end
      limit 200`;
    if (!rows.length) break;
    await removeObjects(rows.map((r) => r.original_key));
    await sql()`update media set original_deleted_at = now() where id = any(${rows.map((r) => r.id)})`;
    deleted += rows.length;
  }
  return deleted;
}

/** Ready media that never got its normalised files (uploaded before the pipeline, or a fast-path failure). */
async function backfillVariants(): Promise<number> {
  const rows = await sql()<{ id: string }[]>`
    select m.id from media m
    where m.state = 'ready' and m.original_deleted_at is null
      and not exists (select 1 from media_variants v where v.media_id = m.id and v.version = ${VARIANT_VERSION})
      and not exists (select 1 from jobs j where j.dedupe_key = 'media.process:' || m.id)
    limit 500`;
  for (const r of rows) await enqueue("media.process", { mediaId: r.id }, `media.process:${r.id}`);
  return rows.length;
}

// ─── Privacy retention and housekeeping (ARCHITECTURE.md §5.2) ───────────────

async function retention(): Promise<Record<string, number>> {
  const ipHashes = await sql()`update reveal_events set ip_hash = null where ip_hash is not null and at < now() - interval '90 days' returning id`;
  const sessions = await sql()`delete from admin_sessions where created_at < now() - interval '30 days' returning admin_id`;
  const emails = await sql()`
    update email_log set to_email = encode(sha256(convert_to(lower(to_email::text), 'UTF8')), 'hex') || '@redacted.invalid'
    where created_at < now() - interval '13 months' and to_email::text not like '%@redacted.invalid'
    returning id`;
  const buckets = await sql()`delete from rate_limit_buckets where expires_at < now() - interval '1 hour' returning key`;
  const idem = await sql()`delete from idempotency_keys where created_at < now() - interval '2 days' returning key`;
  const jobs = await sql()`delete from jobs where state = 'done' and finished_at < now() - interval '30 days' returning id`;
  return {
    ipHashesCleared: ipHashes.length,
    sessionsDeleted: sessions.length,
    emailsPseudonymised: emails.length,
    rateLimitRowsDeleted: buckets.length,
    idempotencyKeysDeleted: idem.length,
    finishedJobsDeleted: jobs.length,
  };
}

/** The nightly run. Each section is isolated: one failing doesn't stop the others. */
export async function runDaily(deadlineMs: number): Promise<{ ok: boolean; summary: Record<string, unknown>; errors: string[] }> {
  const summary: Record<string, unknown> = {};
  const errors: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      summary[name] = await fn();
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
      console.error(`[cron.daily] ${name} failed`, e);
    }
  };
  // Leave the last 20 % of the time for the cheap steps.
  const heavyDeadline = Date.now() + (deadlineMs - Date.now()) * 0.8;

  await step("staleUploadsRejected", rejectStaleUploads);
  await step("orphansSoftRemoved", sweepOrphans);
  await step("mediaPurged", () => purgeExpired(heavyDeadline));
  await step("originalsDeleted", () => deleteProcessedOriginals(heavyDeadline));
  await step("variantsQueued", backfillVariants);
  await step("jobs", () => runJobs(heavyDeadline));
  await step("songs", () => checkSongs({ deadlineMs: heavyDeadline, max: 1000 }));
  await step("retention", retention);
  return { ok: errors.length === 0, summary, errors };
}
