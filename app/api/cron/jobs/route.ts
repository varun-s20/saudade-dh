/**
 * GET /api/cron/jobs (Bearer CRON_SECRET) → 200 JobRunSummary.
 * Runs due jobs (media normalisation retries). The nightly run already includes this; on a plan
 * that allows frequent crons, schedule it every few minutes too (docs/HANDOVER.md §6) so a retry
 * doesn't wait for the night.
 */
import { requireCron } from "@/lib/server/cron-auth";
import { json, route } from "@/lib/server/http";
import { recordRun, runJobs } from "@/lib/server/ops";

export const maxDuration = 300;

export const GET = route(async (req) => {
  requireCron(req);
  const started = new Date();
  try {
    const summary = await runJobs(started.getTime() + 240_000);
    await recordRun("cron.jobs", started, true, { ...summary });
    return json(summary);
  } catch (e) {
    await recordRun("cron.jobs", started, false, {}, e instanceof Error ? e.message : String(e));
    throw e;
  }
});
