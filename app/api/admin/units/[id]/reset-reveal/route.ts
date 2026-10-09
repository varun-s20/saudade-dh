/**
 * POST /api/admin/units/{id}/reset-reveal → 204. [PROPOSED O12] The next recipient tap plays the
 * first-tap ceremony again (a spoiled reveal, a regift, or a demo). Logged as a `reset` event.
 */
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { audit, unitById } from "@/lib/server/envelopes";
import { ApiError, noContent, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  await tx(async (t) => {
    const unit = await unitById(t, id, true);
    if (!unit) throw new ApiError("not_found");
    if (unit.revealed_at) {
      // Without Seal & send (O7 off) a unit reveals straight from "filled".
      const back = unit.sealed_at ? "sealed" : "filled";
      await t`update units set status = ${back}, revealed_at = null where id = ${id}`;
      await t`insert into reveal_events (unit_id, outcome) values (${id}, 'reset')`;
    }
    await audit(t, { unitId: id, action: "unit.reveal_reset", actor: "admin", adminId });
  });
  return noContent();
});
