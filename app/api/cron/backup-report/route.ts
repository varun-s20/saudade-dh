/**
 * POST /api/cron/backup-report (Bearer CRON_SECRET) { ok, summary? } → 204.
 * The nightly off-provider backup (GitHub Actions, docs/BACKUPS.md) reports here when it finishes,
 * so `npm run launch:check` can show when the last good backup ran. Counts only.
 */
import { requireCron } from "@/lib/server/cron-auth";
import { body, noContent, route } from "@/lib/server/http";
import { recordRun } from "@/lib/server/ops";
import { z } from "zod";

const Body = z.object({
  ok: z.boolean(),
  summary: z.record(z.string().max(60), z.union([z.number(), z.string().max(200), z.boolean()])).optional(),
  error: z.string().max(500).optional(),
});

export const POST = route(async (req) => {
  requireCron(req);
  const b = await body(req, Body, 8192);
  await recordRun("backup.nightly", new Date(), b.ok, b.summary ?? {}, b.error);
  return noContent();
});
