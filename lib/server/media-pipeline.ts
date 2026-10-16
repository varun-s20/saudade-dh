/**
 * Media normalisation (ARCHITECTURE.md §7.4–7.5): what every uploaded file becomes before anyone
 * sees it. Pure byte-in, bytes-out functions; storage and the database are lib/server/media-jobs.ts.
 *
 *   Photo → display: long edge ≤ 1600 px, JPEG q80 (mozjpeg), EXIF orientation applied
 *           thumb:   long edge ≤ 480 px, WebP q70
 *           Both are re-encoded with no metadata at all (no EXIF, GPS, XMP), in sRGB, with a
 *           50-megapixel decompression-bomb guard.
 *   Voice → audio:   mono AAC 64 kbps in an MP4 container (.m4a, faststart), loudness-normalised
 *           (EBU R128, −16 LUFS). Plays on every target, including iPhones that can't play the
 *           WebM/Opus that Android Chrome records. The duration is measured here, so the 3:00 cap
 *           doesn't depend on what the browser said.
 *
 * Two kinds of failure, kept apart on purpose:
 *   MediaInvalid     — the file itself is bad (undecodable, too long): reject the upload.
 *   anything else    — a tool or platform problem (no ffmpeg binary, out of memory): the caller
 *                      keeps the verified original and retries later. Never blame the sender.
 */
import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { site } from "@/config/site";
import { env } from "./env";

export const PHOTO_DISPLAY_EDGE = 1600;
export const PHOTO_THUMB_EDGE = 480;
const MAX_INPUT_PIXELS = 50_000_000;
/** Voice cap plus the half-second tolerance the content schema also allows. */
const VOICE_MAX_MS = site.limits.voiceSeconds * 1000 + 500;
const FFMPEG_TIMEOUT_MS = 90_000;

export type VariantName = "display" | "thumb" | "audio";

export interface Variant {
  variant: VariantName;
  bytes: Buffer;
  mime: "image/jpeg" | "image/webp" | "audio/mp4";
  ext: "jpg" | "webp" | "m4a";
  width?: number;
  height?: number;
  durationMs?: number;
}

export class MediaInvalid extends Error {
  constructor(
    readonly code: "upload_failed" | "too_long",
    reason: string,
  ) {
    super(reason);
    this.name = "MediaInvalid";
  }
}

// ─── Photos (sharp) ──────────────────────────────────────────────────────────

export interface ProcessedPhoto {
  variants: Variant[];
  /** Size of the upload after orientation, px. */
  width: number;
  height: number;
}

export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  // Loaded lazily: a missing native binary is a platform problem, not a bad photo.
  const { default: sharp } = await import("sharp");
  const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();

  let meta: { width?: number; height?: number; orientation?: number };
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch (e) {
    throw new MediaInvalid("upload_failed", `not a readable photo (${e instanceof Error ? e.message : "decode failed"})`);
  }
  if (!meta.width || !meta.height) throw new MediaInvalid("upload_failed", "photo has no size");
  // EXIF orientations 5–8 are rotated a quarter turn.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;

  try {
    const display = await base()
      .resize({ width: PHOTO_DISPLAY_EDGE, height: PHOTO_DISPLAY_EDGE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base()
      .resize({ width: PHOTO_THUMB_EDGE, height: PHOTO_THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 70 })
      .toBuffer({ resolveWithObject: true });
    return {
      width,
      height,
      variants: [
        { variant: "display", bytes: display.data, mime: "image/jpeg", ext: "jpg", width: display.info.width, height: display.info.height },
        { variant: "thumb", bytes: thumb.data, mime: "image/webp", ext: "webp", width: thumb.info.width, height: thumb.info.height },
      ],
    };
  } catch (e) {
    throw new MediaInvalid("upload_failed", `photo could not be converted (${e instanceof Error ? e.message : "encode failed"})`);
  }
}

// ─── Voice (ffmpeg) ──────────────────────────────────────────────────────────

/** The ffmpeg binary: FFMPEG_PATH, else the one the ffmpeg-static package downloaded at install. */
async function ffmpegBinary(): Promise<string> {
  const override = env.ffmpegPath();
  if (override) return override;
  const mod = (await import("ffmpeg-static")) as unknown as { default: string | null };
  if (!mod.default) throw new Error("ffmpeg-static has no binary for this platform");
  return mod.default;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d: string) => {
      // Keep the tail only: ffmpeg is chatty and the useful lines come last.
      stderr = (stderr + d).slice(-20_000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e); // spawn failed (no binary, no permission): a platform problem
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** "Duration: 00:01:12.48" from ffmpeg's report on a file, in ms (null if absent). */
export function parseDurationMs(stderr: string): number | null {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!m) return null;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

export interface ProcessedVoice {
  variants: Variant[];
  durationMs: number;
}

export async function processVoice(input: Buffer): Promise<ProcessedVoice> {
  const bin = await ffmpegBinary();
  const dir = await mkdtemp(path.join(tmpdir(), "saudade-voice-"));
  try {
    const src = path.join(dir, "in");
    const out = path.join(dir, "audio.m4a");
    await writeFile(src, input);
    // -t caps the work on an over-long file; anything that reaches the cap is refused below.
    const capSec = String(Math.ceil(VOICE_MAX_MS / 1000) + 2);
    const t = await run(
      bin,
      ["-hide_banner", "-nostdin", "-y", "-i", src, "-vn", "-sn", "-dn", "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "64k", "-t", capSec, "-movflags", "+faststart", out],
      FFMPEG_TIMEOUT_MS,
    );
    if (t.code !== 0) throw new MediaInvalid("upload_failed", `not a readable recording (${lastLine(t.stderr)})`);

    const probe = await run(bin, ["-hide_banner", "-nostdin", "-i", out], 15_000);
    const durationMs = parseDurationMs(probe.stderr);
    if (durationMs === null || durationMs <= 0) throw new MediaInvalid("upload_failed", "recording has no sound");
    if (durationMs > VOICE_MAX_MS) throw new MediaInvalid("too_long", `${(durationMs / 1000).toFixed(1)} s`);
    const bytes = await readFile(out);
    return { durationMs, variants: [{ variant: "audio", bytes, mime: "audio/mp4", ext: "m4a", durationMs }] };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const lastLine = (s: string) => s.trim().split(/\r?\n/).pop()?.slice(0, 160) ?? "ffmpeg failed";
