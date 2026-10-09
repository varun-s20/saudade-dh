/**
 * PUT    /api/sender/contents/{kind} (Bearer) StampContent → 200 ContentRecord (version + 1)
 * DELETE /api/sender/contents/{kind} (Bearer)              → 200 SenderEnvelope
 *
 * Explicit Save only (no autosave). Every save is a new version; removals keep history.
 * 422 when a referenced photo/voice isn't this envelope's or isn't verified yet. 120 / hour.
 */
import { STAMP_KINDS, type StampKind } from "@/lib/services/types";
import { tx } from "@/lib/server/db";
import { assertMediaUsable, audit, parseContent, removeContent, saveContent, senderEnvelope, unitById } from "@/lib/server/envelopes";
import { ApiError, body, json, limit, requireSender, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ kind: string }> };

async function kindOf(ctx: Ctx): Promise<StampKind> {
  const { kind } = await ctx.params;
  if (!(STAMP_KINDS as readonly string[]).includes(kind)) throw new ApiError("not_found", "unknown stamp");
  return kind as StampKind;
}

export const PUT = route<Ctx>(async (req: NextRequest, ctx) => {
  const kind = await kindOf(ctx);
  const { unitId } = await requireSender(req);
  await limit("save", unitId, 3600, 120);
  const content = parseContent(kind, await body(req, z.unknown()));
  const record = await tx(async (t) => {
    const unit = await unitById(t, unitId, true);
    if (!unit) throw new ApiError("not_found");
    await assertMediaUsable(t, unitId, content);
    const rec = await saveContent(t, unit, content, "sender");
    await audit(t, { unitId, action: "content.saved", actor: "sender", detail: `${kind} v${rec.version}` });
    return rec;
  });
  return json(record);
});

export const DELETE = route<Ctx>(async (req: NextRequest, ctx) => {
  const kind = await kindOf(ctx);
  const { unitId } = await requireSender(req);
  await limit("save", unitId, 3600, 120);
  const env = await tx(async (t) => {
    const unit = await unitById(t, unitId, true);
    if (!unit) throw new ApiError("not_found");
    if (await removeContent(t, unit, kind, "sender")) await audit(t, { unitId, action: "content.removed", actor: "sender", detail: kind });
    return senderEnvelope(t, (await unitById(t, unitId))!);
  });
  return json(env);
});
