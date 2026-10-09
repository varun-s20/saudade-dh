/**
 * Media rules (ARCHITECTURE.md §7): what may be uploaded, how big, and what the bytes must be.
 * Photos arrive already compressed in the browser (≤ 2048 px, EXIF dropped by canvas re-encode);
 * voice arrives as the recorder's own format. Server-side normalisation (sharp/ffmpeg) is the
 * Phase 3 job pipeline; until then the verified original is what gets served (D-075).
 */
import "server-only";
import { site } from "@/config/site";
import type { MediaKind, MediaRecord } from "@/lib/services/types";
import { isoReq } from "./db";

export const baseMime = (m: string) => m.split(";")[0].trim().toLowerCase();

const ALLOWED: Record<MediaKind, ReadonlySet<string>> = {
  photo: new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  voice: new Set([
    "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/mpeg", "audio/mp3",
    "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave", "video/mp4", "video/webm",
  ]),
};

export const isAllowedMime = (kind: MediaKind, mime: string) => ALLOWED[kind].has(baseMime(mime));

export const maxBytes = (kind: MediaKind) =>
  (kind === "voice" ? site.limits.voiceUploadMaxMB : site.limits.photoInputMaxMB) * 1024 * 1024;

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));
const starts = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** What the first bytes say the file is, or null if it's nothing we accept. */
export function sniff(b: Uint8Array): { kind: MediaKind; mime: string } | null {
  if (starts(b, [0xff, 0xd8, 0xff])) return { kind: "photo", mime: "image/jpeg" };
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "photo", mime: "image/png" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { kind: "photo", mime: "image/webp" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return { kind: "voice", mime: "audio/wav" };
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (["heic", "heix", "mif1", "msf1", "heis", "hevc"].includes(brand)) return { kind: "photo", mime: "image/heic" };
    return { kind: "voice", mime: "audio/mp4" }; // M4A / mp42 / isom / iso5 … (audio-only checked by the player)
  }
  if (starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "voice", mime: "audio/webm" };
  if (ascii(b, 0, 4) === "OggS") return { kind: "voice", mime: "audio/ogg" };
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: "voice", mime: "audio/mpeg" };
  return null;
}

export interface MediaRow {
  id: string;
  unit_id: string;
  kind: MediaKind;
  state: string;
  declared_mime: string;
  declared_bytes: number | string;
  original_bytes: number | string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: Date;
}

export function toMediaRecord(m: MediaRow): MediaRecord {
  return {
    id: m.id,
    unitId: m.unit_id,
    createdAt: isoReq(m.created_at),
    kind: m.kind,
    mime: baseMime(m.declared_mime),
    bytes: Number(m.original_bytes ?? m.declared_bytes),
    ...(m.width ? { width: m.width } : {}),
    ...(m.height ? { height: m.height } : {}),
    ...(m.duration_ms ? { durationSec: m.duration_ms / 1000 } : {}),
  };
}
