/**
 * Authorisation for the scheduled-task routes (app/api/cron/*). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically once CRON_SECRET is set on the project; the
 * nightly backup workflow sends the same header. Without CRON_SECRET every call is refused.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "./env";
import { ApiError } from "./http";

export function requireCron(req: NextRequest): void {
  const secret = env.cronSecret();
  if (!secret) throw new ApiError("unauthorized", "CRON_SECRET is not set on this deployment", undefined, 503);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApiError("unauthorized", "cron");
}
