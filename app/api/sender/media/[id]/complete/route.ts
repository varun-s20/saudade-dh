/**
 * POST /api/sender/media/{id}/complete (Bearer) → 200 MediaRecord (idempotent once ready).
 * Never trusts the client: the object must exist in Storage, be within the size limit, and its
 * first bytes must be an accepted image or audio format of the declared kind.
 * 422 upload_failed (missing / wrong bytes) · 413 too_large · 404.
 */
import { sql } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { ApiError, json, requireSender, route } from "@/lib/server/http";
import { maxBytes, sniff, toMediaRecord, type MediaRow } from "@/lib/server/media";
import { firstBytes, objectInfo, objectKey } from "@/lib/server/storage";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const { unitId } = await requireSender(req);
  if (!/^med_[a-z2-7]{26}$/.test(id)) throw new ApiError("not_found");

  const [m] = await sql()<MediaRow[]>`
    select id, unit_id, kind, state, declared_mime, declared_bytes, original_bytes, width, height, duration_ms, created_at
    from media where id = ${id} and unit_id = ${unitId}`;
  if (!m) throw new ApiError("not_found");
  if (m.state === "ready") return json(toMediaRecord(m));
  if (m.state !== "awaiting_upload" && m.state !== "uploaded") throw new ApiError("upload_failed", `media is ${m.state}`);

  const key = objectKey(unitId, id);
  const reject = async (code: "upload_failed" | "too_large", reason: string): Promise<never> => {
    await sql()`update media set state = 'rejected', rejection_reason = ${reason} where id = ${id}`;
    await audit(sql(), { unitId, action: "media.rejected", actor: "system", detail: reason });
    throw new ApiError(code, reason);
  };

  const info = await objectInfo(key);
  if (!info) throw new ApiError("upload_failed", "the file never arrived; try again");
  if (info.size > maxBytes(m.kind)) return reject("too_large", `${info.size} bytes`);
  const head = await firstBytes(key);
  const found = head ? sniff(head) : null;
  if (!found || found.kind !== m.kind) return reject("upload_failed", `not an accepted ${m.kind} file`);

  const [ready] = await sql()<MediaRow[]>`
    update media set state = 'ready', detected_mime = ${found.mime}, original_bytes = ${info.size},
                     uploaded_at = coalesce(uploaded_at, now()), ready_at = now()
    where id = ${id}
    returning id, unit_id, kind, state, declared_mime, declared_bytes, original_bytes, width, height, duration_ms, created_at`;
  return json(toMediaRecord(ready));
});
