/** GET /api/admin/readiness → 200 Readiness (the launch checklist on the admin dashboard). */
import { requireAdmin } from "@/lib/server/admin-auth";
import { json, route } from "@/lib/server/http";
import { readiness } from "@/lib/server/readiness";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await readiness());
});
