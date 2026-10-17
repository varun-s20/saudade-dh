/**
 * The durable job queue (the `jobs` table; ARCHITECTURE.md §5, §7.6). Work that must eventually
 * happen but needn't block a request: today, finishing media normalisation when the fast path in
 * POST /api/sender/media/{id}/complete couldn't (a platform hiccup, not a bad file).
 *
 * Workers claim one job at a time with `for update skip locked`, so two cron runs never take the
 * same job. A failure retries with exponential backoff (2, 4, 8… minutes, at most 6 hours) up to
 * max_attempts, then the job is `dead` and `npm run launch:check` reports it.
 */
import "server-only";
import type postgres from "postgres";
import { sql } from "./db";

export type JobKind = "media.process";

export type JobHandlers = Record<JobKind, (payload: Record<string, unknown>) => Promise<void>>;

/** A failure retrying can't fix (e.g. the file itself is bad): goes straight to `dead`. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

/** Queue a job once: a second enqueue with the same dedupe key is ignored. */
export async function enqueue(kind: JobKind, payload: Record<string, unknown>, dedupeKey: string, delaySec = 0): Promise<void> {
  await sql()`
    insert into jobs (kind, payload, dedupe_key, run_after)
    values (${kind}, ${sql().json(payload as postgres.JSONValue)}, ${dedupeKey}, now() + make_interval(secs => ${delaySec}))
    on conflict (dedupe_key) do nothing`;
}

export interface JobRunSummary {
  ran: number;
  done: number;
  retried: number;
  dead: number;
}

interface JobRow {
  id: string | number;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

const backoffSec = (attempts: number) => Math.min(6 * 3600, 60 * 2 ** attempts);

/** Run due jobs until none are left, `max` have run, or the deadline passes. */
export async function runDueJobs(handlers: JobHandlers, opts: { max: number; deadlineMs: number }): Promise<JobRunSummary> {
  const summary: JobRunSummary = { ran: 0, done: 0, retried: 0, dead: 0 };
  // A function that crashed mid-job leaves it `running`: hand it back after 10 minutes.
  await sql()`update jobs set state = 'queued', locked_at = null where state = 'running' and locked_at < now() - interval '10 minutes'`;

  while (summary.ran < opts.max && Date.now() < opts.deadlineMs) {
    const [job] = await sql()<JobRow[]>`
      update jobs set state = 'running', locked_at = now(), attempts = attempts + 1
      where id = (
        select id from jobs where state = 'queued' and run_after <= now()
        order by run_after, id for update skip locked limit 1
      )
      returning id, kind, payload, attempts, max_attempts`;
    if (!job) break;
    summary.ran++;
    try {
      const handler = handlers[job.kind];
      if (!handler) throw new PermanentJobError(`no handler for ${job.kind}`);
      await handler(job.payload ?? {});
      await sql()`update jobs set state = 'done', finished_at = now(), locked_at = null, last_error = null where id = ${job.id}`;
      summary.done++;
    } catch (e) {
      const message = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 1000);
      if (e instanceof PermanentJobError || job.attempts >= job.max_attempts) {
        await sql()`update jobs set state = 'dead', finished_at = now(), locked_at = null, last_error = ${message} where id = ${job.id}`;
        summary.dead++;
        console.error(`[jobs] ${job.kind} #${job.id} is dead: ${message}`);
      } else {
        await sql()`update jobs set state = 'queued', locked_at = null, last_error = ${message},
                      run_after = now() + make_interval(secs => ${backoffSec(job.attempts)}) where id = ${job.id}`;
        summary.retried++;
      }
    }
  }
  return summary;
}
