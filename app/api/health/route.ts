/** GET /api/health → { ok, db } for uptime checks. No secrets, no counts. */
import { sql } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  let db = false;
  try {
    await sql()`select 1`;
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: db, db }, db ? 200 : 503);
});
