/**
 * MediaService over HTTP. Upload is the presigned-PUT flow (ARCHITECTURE.md §7):
 *
 *   1. POST /api/sender/media/uploads          → { mediaId, upload: { url, headers, expiresAt } }
 *   2. PUT  <presigned R2 URL> (XHR, progress) → 200 from object storage
 *   3. POST /api/sender/media/{id}/complete    → MediaRecord (server checks size + magic bytes,
 *                                                then queues normalisation / transcoding)
 *
 * Reads: envelopes come back with a `mediaUrls` map of short-lived signed URLs, primed into the
 * cache below, so getUrl() is usually a memory hit. Otherwise it returns the stable
 * `/api/media/{id}` path, which 302-redirects to a fresh signed URL (and 404s once removed).
 */
import { site } from "@/config/site";
import type { MediaRecord, MediaService, ServiceResult } from "@/lib/services/types";
import { API_BASE, fail, path, putWithProgress, request } from "./http";

export interface SignedMediaUrl {
  url: string;
  /** ISO timestamp; the URL must not be used after this. */
  expiresAt: string;
}

/** Envelope responses carry signed URLs alongside the typed payload (wire-only field). */
export type WithMediaUrls<T> = T & { mediaUrls?: Record<string, SignedMediaUrl> };

interface UploadTicket {
  mediaId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

/** Refresh a minute early so an <img> never starts loading an about-to-expire URL. */
const EXPIRY_MARGIN_MS = 60_000;
const urlCache = new Map<string, SignedMediaUrl>();

export function primeMediaUrls(map: Record<string, SignedMediaUrl> | undefined): void {
  if (!map) return;
  for (const [id, signed] of Object.entries(map)) urlCache.set(id, signed);
}

/** Strip the wire-only field and remember the URLs. */
export function takeMediaUrls<T extends object>(payload: WithMediaUrls<T>): T {
  const { mediaUrls, ...rest } = payload;
  primeMediaUrls(mediaUrls);
  return rest as T;
}

const errorOf = <T,>(r: ServiceResult<unknown> & { ok: false }): ServiceResult<T> => ({ ok: false, error: r.error });

export const apiMediaService: MediaService = {
  async upload(token, blob, meta, onProgress) {
    // Same pre-checks as the server, so the user hears about limits before uploading.
    const maxMB = meta.kind === "voice" ? site.limits.voiceUploadMaxMB : site.limits.photoInputMaxMB;
    if (blob.size > maxMB * 1024 * 1024) return fail("too_large", { detail: `${(blob.size / 1048576).toFixed(1)} MB > ${maxMB} MB` });
    if (meta.kind === "voice" && (meta.durationSec ?? 0) > site.limits.voiceSeconds + 0.5) return fail("too_long");

    onProgress?.(0);
    const ticket = await request<UploadTicket>({
      method: "POST",
      path: "/api/sender/media/uploads",
      auth: { sender: token },
      body: { ...meta, mime: blob.type || meta.mime, bytes: blob.size },
    });
    if (!ticket.ok) return errorOf(ticket);

    const { mediaId, upload } = ticket.data;
    // Reserve the last 5 % of the bar for server-side verification.
    const put = await putWithProgress(upload.url, blob, upload.headers, (f) => onProgress?.(f * 0.95));
    if (!put.ok) return errorOf(put);

    const done = await request<MediaRecord>({
      method: "POST",
      path: path`/api/sender/media/${mediaId}/complete`,
      auth: { sender: token },
      timeoutMs: 30_000,
    });
    if (done.ok) onProgress?.(1);
    return done;
  },

  async getUrl(mediaId) {
    const cached = urlCache.get(mediaId);
    if (cached && Date.parse(cached.expiresAt) - EXPIRY_MARGIN_MS > Date.now()) return cached.url;
    urlCache.delete(mediaId);
    // Stable path; the server answers 302 → fresh signed URL (Cache-Control: private, max-age=600).
    return `${API_BASE}${path`/api/media/${mediaId}`}`;
  },

  async remove(token, mediaId) {
    const res = await request<void>({
      method: "DELETE",
      path: path`/api/sender/media/${mediaId}`,
      auth: { sender: token },
      expect: "empty",
    });
    if (res.ok) urlCache.delete(mediaId);
    return res;
  },
};
