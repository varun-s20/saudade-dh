/** GET /api/sender/envelope (Bearer) → 200 SenderEnvelope + mediaUrls · 404 unknown/revoked link. */
import { sql } from "@/lib/server/db";
import { senderEnvelope, unitById } from "@/lib/server/envelopes";
import { ApiError, json, requireSender, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { unitId } = await requireSender(req);
  const unit = await unitById(sql(), unitId);
  if (!unit) throw new ApiError("not_found");
  return json(await senderEnvelope(sql(), unit));
});
