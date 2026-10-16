/**
 * Media storage on Supabase Storage (one private bucket). Browsers never get the service key:
 * uploads go straight to Storage through a single-use signed upload URL, and reads use
 * short-lived signed URLs (ARCHITECTURE.md §7, with Supabase in place of R2: D-075).
 *
 * Key layout:
 *   incoming/{unit_id}/{media_id}                      the verified upload (never overwritten)
 *   media/{unit_id}/{media_id}/v{n}/{variant}.{ext}    normalised files (display.jpg, thumb.webp,
 *                                                       audio.m4a), immutable once recorded in
 *                                                       media_variants; a reprocess is v{n+1}
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const globalForStorage = globalThis as unknown as { saudadeStorage?: SupabaseClient };

function client(): SupabaseClient {
  if (!globalForStorage.saudadeStorage) {
    globalForStorage.saudadeStorage = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return globalForStorage.saudadeStorage;
}

const bucket = () => client().storage.from(env.mediaBucket());

export const objectKey = (unitId: string, mediaId: string) => `incoming/${unitId}/${mediaId}`;

export const variantKey = (unitId: string, mediaId: string, version: number, variant: string, ext: string) =>
  `media/${unitId}/${mediaId}/v${version}/${variant}.${ext}`;

/** Signed URLs are valid for an hour; envelopes are re-fetched long before that. */
export const READ_TTL_SEC = 3600;

export async function signedUpload(key: string, mime: string): Promise<{ url: string; headers: Record<string, string> }> {
  const { data, error } = await bucket().createSignedUploadUrl(key);
  if (error || !data) throw new Error(`storage: signed upload failed (${error?.message ?? "no data"})`);
  return {
    url: data.signedUrl,
    // What Supabase's own uploadToSignedUrl sends for a raw body.
    headers: { "content-type": mime, "x-upsert": "false", "cache-control": "max-age=31536000" },
  };
}

/** Size and content type of a stored object, or null if it doesn't exist. */
export async function objectInfo(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const { data, error } = await bucket().info(key);
  if (error || !data) return null;
  const size = Number((data as { size?: number }).size ?? 0);
  return { size, contentType: (data as { contentType?: string }).contentType ?? null };
}

/** The first `n` bytes of an object (magic-byte sniffing), via a ranged GET on a signed URL. */
export async function firstBytes(key: string, n = 64): Promise<Uint8Array | null> {
  const { data, error } = await bucket().createSignedUrl(key, 60);
  if (error || !data) return null;
  const res = await fetch(data.signedUrl, { headers: { range: `bytes=0-${n - 1}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok && res.status !== 206) return null;
  return new Uint8Array(await res.arrayBuffer()).subarray(0, n);
}

/** One signed read URL per key (batched). Missing objects are simply absent from the map. */
export async function signedReads(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!keys.length) return out;
  const { data, error } = await bucket().createSignedUrls(keys, READ_TTL_SEC);
  if (error || !data) throw new Error(`storage: signed reads failed (${error?.message ?? "no data"})`);
  for (const d of data) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}

export async function signedRead(key: string): Promise<string | null> {
  const { data, error } = await bucket().createSignedUrl(key, READ_TTL_SEC);
  return error || !data ? null : data.signedUrl;
}

/** Upload server-side (seed scripts and tooling only; the app never proxies user uploads). */
export async function putObject(key: string, bytes: Uint8Array, mime: string): Promise<void> {
  const { error } = await bucket().upload(key, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`storage: upload failed (${error.message})`);
}

/**
 * Write a normalised variant. Upsert is safe here: a variant key is only overwritten by a retry of
 * the same processing run before its media_variants row exists (the deterministic output of the
 * same input). Once recorded, a key is never written again (reprocessing uses a new version).
 */
export async function putVariant(key: string, bytes: Uint8Array, mime: string): Promise<void> {
  const { error } = await bucket().upload(key, bytes, { contentType: mime, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`storage: variant upload failed (${error.message})`);
}

/** The whole object (server-side processing of an upload; ≤ 30 MB by the upload limits). */
export async function download(key: string): Promise<Buffer> {
  const { data, error } = await bucket().download(key);
  if (error || !data) throw new Error(`storage: download failed (${error?.message ?? "no data"})`);
  return Buffer.from(await data.arrayBuffer());
}

/** Delete objects for good (purge after the 90-day recovery window, raw-upload cleanup). */
export async function removeObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await bucket().remove(keys.slice(i, i + 100));
    if (error) throw new Error(`storage: remove failed (${error.message})`);
  }
}
