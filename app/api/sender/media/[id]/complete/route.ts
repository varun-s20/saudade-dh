/**
 * POST /api/sender/media/{id}/complete (Bearer) → 200 MediaRecord (idempotent once ready).
 *
 * Never trusts the client: the object must exist in Storage, be within the size limit, and its
 * first bytes must be an accepted image or audio format of the declared kind. Then the file is
 * normalised right here (the fast path, ARCHITECTURE.md §7.6): photos become a display JPEG and a
 * thumbnail with no metadata, voice notes become AAC/m4a with their real duration measured.
 *
 * 422 upload_failed (missing / wrong / undecodable bytes) · 422 too_long (voice over 3:00) ·
 * 413 too_large · 404.
 *
 * If normalising fails for a platform reason (not the file's fault), the verified original is
 * served for now and a `media.process` job finishes the work later, so the sender is never
 * blocked by the pipeline.
 */
import { sql } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { ApiError, json, requireSender, route } from "@/lib/server/http";
import { enqueue } from "@/lib/server/jobs";
import { maxBytes, sniff, toMediaRecord, type MediaRow } from "@/lib/server/media";
import { normaliseMedia, recordNormalised } from "@/lib/server/media-jobs";
import { MediaInvalid } from "@/lib/server/media-pipeline";
import { firstBytes, objectInfo, objectKey } from "@/lib/server/storage";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

/** A three-minute voice note takes a few seconds to transcode; leave room for a slow cold start. */
export const maxDuration = 60;

const MEDIA_COLS = "id, unit_id, kind, state, declared_mime, declared_bytes, original_bytes, width, height, duration_ms, created_at";

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const { unitId } = await requireSender(req);
  if (!/^med_[a-z2-7]{26}$/.test(id)) throw new ApiError("not_found");

  const [m] = await sql().unsafe<MediaRow[]>(`select ${MEDIA_COLS} from media where id = $1 and unit_id = $2`, [id, unitId]);
  if (!m) throw new ApiError("not_found");
  if (m.state === "ready") return json(toMediaRecord(m));
  if (m.state !== "awaiting_upload" && m.state !== "uploaded") throw new ApiError("upload_failed", `media is ${m.state}`);

  const key = objectKey(unitId, id);
  const reject = async (code: "upload_failed" | "too_large" | "too_long", reason: string): Promise<never> => {
    await sql()`update media set state = 'rejected', rejection_reason = ${reason.slice(0, 200)} where id = ${id}`;
    await audit(sql(), { unitId, action: "media.rejected", actor: "system", detail: reason });
    throw new ApiError(code, reason);
  };

  const info = await objectInfo(key);
  if (!info) throw new ApiError("upload_failed", "the file never arrived; try again");
  if (info.size > maxBytes(m.kind)) return reject("too_large", `${info.size} bytes`);
  const head = await firstBytes(key);
  const found = head ? sniff(head) : null;
  if (!found || found.kind !== m.kind) return reject("upload_failed", `not an accepted ${m.kind} file`);

  await sql()`update media set state = 'uploaded', detected_mime = ${found.mime}, original_bytes = ${info.size},
                uploaded_at = coalesce(uploaded_at, now()) where id = ${id}`;

  try {
    await recordNormalised(id, await normaliseMedia({ id, unit_id: unitId, kind: m.kind, original_key: key }));
  } catch (e) {
    if (e instanceof MediaInvalid) return reject(e.code, e.message);
    console.error(`[media] normalising ${id} failed; serving the verified original until the retry job`, e);
    await enqueue("media.process", { mediaId: id }, `media.process:${id}`, 60);
  }

  const [ready] = await sql().unsafe<MediaRow[]>(
    `update media set state = 'ready', ready_at = coalesce(ready_at, now()) where id = $1 returning ${MEDIA_COLS}`,
    [id],
  );
  return json(toMediaRecord(ready));
});
