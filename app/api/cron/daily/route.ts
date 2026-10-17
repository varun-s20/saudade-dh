/**
 * GET /api/cron/daily (Bearer CRON_SECRET) → 200 { ok, summary, errors }.
 * The nightly run (vercel.json, 03:00 UTC): media lifecycle, the job queue, song checks and the
 * privacy-retention clean-up (lib/server/ops.ts). Recorded in ops_runs (read by `npm run launch:check`).
 */
import { requireCron } from "@/lib/server/cron-auth";
import { json, route } from "@/lib/server/http";
import { recordRun, runDaily } from "@/lib/server/ops";

export const maxDuration = 300;

export const GET = route(async (req) => {
  requireCron(req);
  const started = new Date();
  const result = await runDaily(started.getTime() + 240_000);
  await recordRun("cron.daily", started, result.ok, result.summary, result.errors.join("; ") || undefined);
  return json(result, result.ok ? 200 : 500);
});
