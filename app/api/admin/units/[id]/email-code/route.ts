/**
 * POST /api/admin/units/{id}/email-code { to } → 200 EmailMessage. Path B (gift shipped straight
 * to the friend, no card in the box): a fresh code is minted (the stored HMAC can't be turned back
 * into a code) and emailed to the buyer. 409 already_claimed if the current code was redeemed:
 * reset it deliberately first, so a working sender is never cut off by accident.
 */
import { giftCodeEmail } from "@/lib/email/templates";
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { audit, unitById } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { ApiError, body, json, originOf, route } from "@/lib/server/http";
import { mintCode } from "@/lib/server/tokens";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ to: z.email().max(254) });

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  const to = (await body(req, Body, 1024)).to.trim().toLowerCase();

  const code = await tx(async (t) => {
    const unit = await unitById(t, id, true);
    if (!unit) throw new ApiError("not_found");
    if (unit.code_redeemed_at) throw new ApiError("already_claimed", "reset the code first");
    const fresh = await mintCode(t, id);
    await t`update units set delivery_path = 'B', code_emailed_at = now(), code_emailed_to = ${to},
              status = case when status = 'unassigned' then 'assigned'::unit_status else status end
            where id = ${id}`;
    await audit(t, { unitId: id, action: "unit.code_emailed", actor: "admin", adminId, detail: to });
    return fresh;
  });

  const sent = await sendEmail(giftCodeEmail({ to, code, origin: originOf(req, env.publicOrigin()) }), id);
  return json(sent);
});
