/**
 * POST /api/sender/media/uploads (Bearer) MediaMeta + { mime, bytes }
 *   → 201 { mediaId, upload: { url, method: "PUT", headers, expiresAt } }
 * The browser PUTs the bytes straight to Supabase Storage with that single-use signed URL;
 * nothing passes through this function. 413 too_large · 422 too_long / unsupported type.
 * 60 uploads / hour / envelope, at most 40 unfinished at once.
 */
import { site } from "@/config/site";
import { newMediaId } from "@/lib/server/crypto";
import { sql } from "@/lib/server/db";
import { ApiError, body, json, limit, requireSender, route } from "@/lib/server/http";
import { baseMime, isAllowedMime, maxBytes } from "@/lib/server/media";
import { objectKey, signedUpload } from "@/lib/server/storage";
import { z } from "zod";

const Body = z.object({
  kind: z.enum(["photo", "voice"]),
  mime: z.string().min(3).max(100),
  bytes: z.number().int().positive(),
  width: z.number().int().min(1).max(20000).optional(),
  height: z.number().int().min(1).max(20000).optional(),
  durationSec: z.number().positive().optional(),
});

/** Supabase signed upload URLs are valid for 2 hours. */
const UPLOAD_TTL_MS = 2 * 3600_000;

export const POST = route(async (req) => {
  const { unitId } = await requireSender(req);
  const meta = await body(req, Body, 4096);
  if (meta.bytes > maxBytes(meta.kind)) throw new ApiError("too_large", `${(meta.bytes / 1048576).toFixed(1)} MB`);
  if (meta.kind === "voice" && (meta.durationSec ?? 0) > site.limits.voiceSeconds + 0.5) throw new ApiError("too_long");
  if (!isAllowedMime(meta.kind, meta.mime)) throw new ApiError("upload_failed", `unsupported type ${baseMime(meta.mime)}`);
  await limit("upload", unitId, 3600, 60);

  const [{ pending }] = await sql()<{ pending: number }[]>`
    select count(*)::int as pending from media
    where unit_id = ${unitId} and state = 'awaiting_upload' and created_at > now() - interval '1 day'`;
  if (pending >= 40) throw new ApiError("rate_limited", "too many unfinished uploads", 600);

  const id = newMediaId();
  const key = objectKey(unitId, id);
  await sql()`
    insert into media (id, unit_id, kind, declared_mime, declared_bytes, original_key, width, height, duration_ms)
    values (${id}, ${unitId}, ${meta.kind}, ${meta.mime.slice(0, 100)}, ${meta.bytes}, ${key},
            ${meta.width ?? null}, ${meta.height ?? null},
            ${meta.durationSec ? Math.max(1, Math.round(meta.durationSec * 1000)) : null})`;
  const upload = await signedUpload(key, baseMime(meta.mime));
  return json(
    { mediaId: id, upload: { url: upload.url, method: "PUT", headers: upload.headers, expiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString() } },
    201,
  );
});
