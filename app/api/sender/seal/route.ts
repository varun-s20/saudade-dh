/**
 * POST /api/sender/seal (Bearer) → 200 SenderEnvelope · 409 nothing_to_seal · 404.
 * [PROPOSED O7] Arms the first-tap reveal. Idempotent once sealed (or revealed). 30 / hour.
 */
import { tx } from "@/lib/server/db";
import { audit, currentContents, hasContent, senderEnvelope, unitById } from "@/lib/server/envelopes";
import { ApiError, json, limit, requireSender, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { unitId } = await requireSender(req);
  await limit("seal", unitId, 3600, 30);
  const env = await tx(async (t) => {
    const unit = await unitById(t, unitId, true);
    if (!unit) throw new ApiError("not_found");
    if (!hasContent(await currentContents(t, unitId))) throw new ApiError("nothing_to_seal");
    if (unit.status !== "sealed" && unit.status !== "revealed") {
      await t`update units set status = 'sealed', sealed_at = now() where id = ${unitId}`;
      await audit(t, { unitId, action: "unit.sealed", actor: "sender" });
    }
    return senderEnvelope(t, (await unitById(t, unitId))!);
  });
  return json(env);
});
