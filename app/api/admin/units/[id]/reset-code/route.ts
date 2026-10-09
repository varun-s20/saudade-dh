/**
 * POST /api/admin/units/{id}/reset-code → 200 { code } (in clear, this once).
 * The old code and every private link stop working; contents, seal and reveal are untouched, so
 * the rightful sender reclaims the same envelope with the new code (ARCHITECTURE.md §4.2).
 */
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { audit, unitById } from "@/lib/server/envelopes";
import { ApiError, json, route } from "@/lib/server/http";
import { mintCode, revokeTokens } from "@/lib/server/tokens";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  const code = await tx(async (t) => {
    if (!(await unitById(t, id, true))) throw new ApiError("not_found");
    const fresh = await mintCode(t, id);
    const revoked = await revokeTokens(t, id, "code_reset");
    await audit(t, { unitId: id, action: "unit.code_reset", actor: "admin", adminId });
    if (revoked) await audit(t, { unitId: id, action: "unit.tokens_revoked", actor: "admin", adminId, detail: `${revoked} link(s)` });
    return fresh;
  });
  return json({ code });
});
