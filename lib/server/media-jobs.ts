/**
 * Media normalisation against storage and the database: download the verified upload, run it
 * through lib/server/media-pipeline.ts, store the variants under immutable keys and record them in
 * `media_variants`. Used by the upload fast path (/complete) and by the `media.process` job.
 */
import "server-only";
import { sql } from "./db";
import { PermanentJobError } from "./jobs";
import { MediaInvalid, processPhoto, processVoice } from "./media-pipeline";
import { download, putVariant, variantKey } from "./storage";

/**
 * Output version of the pipeline. Bump it when the output format changes: new keys are written
 * (v2/…) and every existing file stays where it is, so nothing is ever overwritten.
 */
export const VARIANT_VERSION = 1;

/** What normalisation learned about the file (stored on the media row). */
export interface NormalisedInfo {
  width?: number;
  height?: number;
  durationMs?: number;
}

interface MediaSource {
  id: string;
  unit_id: string;
  kind: "photo" | "voice";
  original_key: string;
}

/** Normalise one media item. Throws MediaInvalid for a bad file; anything else is a platform problem. */
export async function normaliseMedia(m: MediaSource): Promise<NormalisedInfo> {
  const input = await download(m.original_key);
  const result = m.kind === "photo" ? await processPhoto(input) : await processVoice(input);
  for (const v of result.variants) {
    const key = variantKey(m.unit_id, m.id, VARIANT_VERSION, v.variant, v.ext);
    await putVariant(key, v.bytes, v.mime);
    await sql()`
      insert into media_variants (media_id, variant, version, r2_key, mime, bytes, width, height, duration_ms)
      values (${m.id}, ${v.variant}, ${VARIANT_VERSION}, ${key}, ${v.mime}, ${v.bytes.length},
              ${v.width ?? null}, ${v.height ?? null}, ${v.durationMs ?? null})
      on conflict (media_id, variant, version) do nothing`;
  }
  return "durationMs" in result ? { durationMs: result.durationMs } : { width: result.width, height: result.height };
}

/** Store what normalisation measured (real size and duration, not what the browser declared). */
export async function recordNormalised(mediaId: string, info: NormalisedInfo): Promise<void> {
  await sql()`
    update media set width = coalesce(${info.width ?? null}, width), height = coalesce(${info.height ?? null}, height),
                     duration_ms = coalesce(${info.durationMs ?? null}, duration_ms)
    where id = ${mediaId}`;
}

/** The `media.process` job: finish a media item the fast path couldn't. Idempotent. */
export async function processMediaJob(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.mediaId === "string" ? payload.mediaId : "";
  const [m] = await sql()<(MediaSource & { removed: boolean; variants: number })[]>`
    select m.id, m.unit_id, m.kind, m.original_key, (m.removed_at is not null) as removed,
           (select count(*)::int from media_variants v where v.media_id = m.id and v.version = ${VARIANT_VERSION}) as variants
    from media m where m.id = ${id}`;
  if (!m || m.removed || m.variants > 0) return; // gone, removed, or already done
  try {
    await recordNormalised(m.id, await normaliseMedia(m));
  } catch (e) {
    // The original is already being served; a file the pipeline can't read won't improve with retries.
    if (e instanceof MediaInvalid) throw new PermanentJobError(`media ${m.id}: ${e.message}`);
    throw e;
  }
}
