/** GET /api/health → { ok, db, version } for uptime checks. No secrets, no counts. */
import { sql } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  let db = false;
  try {
    await sql()`select 1`;
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: db, db, version: env.version() }, db ? 200 : 503);
});
