import { site } from "@/config/site";
import { generateId } from "@/lib/parsing/codes";
import type { MediaRecord, MediaService } from "@/lib/services/types";
import { isForced } from "@/lib/state/demo";
import { useDemo } from "@/lib/state/demo";
import { deleteBlob, getBlobUrl, putBlob } from "@/lib/state/media-store";
import { db, fail, latency, nowIso, ok, ready, unitByToken, update } from "./runtime";

const DEMO_PREFIX = "demo:";

export const mediaService: MediaService = {
  async upload(token, blob, meta, onProgress) {
    await ready();
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");

    const maxMB = meta.kind === "voice" ? site.limits.voiceUploadMaxMB : site.limits.photoInputMaxMB;
    if (blob.size > maxMB * 1024 * 1024) return fail("too_large", { detail: `${(blob.size / 1048576).toFixed(1)} MB > ${maxMB} MB` });
    if (meta.kind === "voice" && (meta.durationSec ?? 0) > site.limits.voiceSeconds + 0.5) return fail("too_long");

    // Simulated upload progress, roughly proportional to size (≈ 4G uplink), capped for demos.
    const fast = useDemo.getState().fast;
    const totalMs = fast ? 150 : Math.min(2600, 500 + blob.size / 900);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, totalMs / steps));
      onProgress?.(Math.min(0.97, i / steps));
      if (isForced("upload_failed") && i === Math.ceil(steps * 0.6)) return fail("upload_failed");
    }

    const id = generateId(meta.kind === "photo" ? "img" : "aud");
    try {
      await putBlob(id, blob);
    } catch {
      return fail("upload_failed", { detail: "IndexedDB write failed" });
    }
    const record: MediaRecord = { ...meta, id, unitId: unit.id, createdAt: nowIso() };
    update((s) => ({ media: { ...s.media, [id]: record } }));
    await latency(0.3);
    onProgress?.(1);
    return ok(record);
  },

  async getUrl(mediaId) {
    if (mediaId.startsWith(DEMO_PREFIX)) return `/demo/${mediaId.slice(DEMO_PREFIX.length)}`;
    return getBlobUrl(mediaId);
  },

  async remove(token, mediaId) {
    await ready();
    await latency(0.5);
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");
    if (mediaId.startsWith(DEMO_PREFIX)) return ok(undefined);
    if (db().media[mediaId]?.unitId !== unit.id) return fail("not_found");
    // Production keeps the object (R2 versioning) and only removes the reference.
    await deleteBlob(mediaId);
    update((s) => {
      const media = { ...s.media };
      delete media[mediaId];
      return { media };
    });
    return ok(undefined);
  },
};
