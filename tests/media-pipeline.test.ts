import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { MediaInvalid, parseDurationMs, PHOTO_DISPLAY_EDGE, PHOTO_THUMB_EDGE, processPhoto, processVoice } from "@/lib/server/media-pipeline";

const require = createRequire(import.meta.url);
const dir = mkdtempSync(path.join(tmpdir(), "saudade-media-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Make an audio file with the bundled ffmpeg. */
function audio(name: string, args: string[]): Buffer {
  const out = path.join(dir, name);
  execFileSync(require("ffmpeg-static") as string, ["-hide_banner", "-loglevel", "error", "-y", ...args, out]);
  return readFileSync(out);
}

describe("photos", () => {
  it("makes a display JPEG and a WebP thumbnail within their sizes", async () => {
    const input = readFileSync("public/demo/photos/01.jpg");
    const meta = await sharp(input).metadata();
    const out = await processPhoto(input);
    expect([out.width, out.height]).toEqual([meta.width, meta.height]);
    const display = out.variants.find((v) => v.variant === "display")!;
    const thumb = out.variants.find((v) => v.variant === "thumb")!;
    expect(display.mime).toBe("image/jpeg");
    expect(thumb.mime).toBe("image/webp");
    expect(Math.max(display.width!, display.height!)).toBeLessThanOrEqual(PHOTO_DISPLAY_EDGE);
    expect(Math.max(thumb.width!, thumb.height!)).toBeLessThanOrEqual(PHOTO_THUMB_EDGE);
    expect(thumb.bytes.length).toBeLessThan(display.bytes.length);
  });

  it("applies the camera's orientation and keeps no metadata (no EXIF, no GPS)", async () => {
    // A 400×200 photo stored sideways (EXIF orientation 6 = turn 90° clockwise), with EXIF.
    const sideways = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#c96" } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Make: "TestCam", Copyright: "secret" } } })
      .toBuffer();
    expect((await sharp(sideways).metadata()).exif).toBeDefined();
    const out = await processPhoto(sideways);
    expect([out.width, out.height]).toEqual([200, 400]);
    for (const v of out.variants) {
      const m = await sharp(v.bytes).metadata();
      expect(m.exif).toBeUndefined();
      expect(m.orientation ?? 1).toBe(1);
      expect([v.width, v.height]).toEqual([200, 400]);
    }
  });

  it("never enlarges a small photo", async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#123" } }).png().toBuffer();
    const out = await processPhoto(small);
    expect(out.variants.find((v) => v.variant === "display")).toMatchObject({ width: 300, height: 200 });
  });

  it("refuses a file that only looks like a JPEG", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, 0x41)]);
    await expect(processPhoto(fake)).rejects.toBeInstanceOf(MediaInvalid);
  });

  it("refuses a decompression bomb", async () => {
    // 60 megapixels of black: tiny on disk, 180 MB once decoded. The 50 MP guard refuses it.
    const huge = await sharp({ create: { width: 10000, height: 6000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processPhoto(huge)).rejects.toBeInstanceOf(MediaInvalid);
  });
});

describe("voice notes", () => {
  it("turns an Android WebM/Opus recording into AAC/m4a and measures it", async () => {
    const webm = audio("note.webm", ["-f", "lavfi", "-i", "sine=frequency=330:duration=5", "-c:a", "libopus", "-b:a", "32k"]);
    const out = await processVoice(webm);
    expect(out.durationMs).toBeGreaterThan(4500);
    expect(out.durationMs).toBeLessThan(5500);
    const [v] = out.variants;
    expect(v).toMatchObject({ variant: "audio", mime: "audio/mp4", ext: "m4a" });
    expect(v.bytes.subarray(4, 8).toString("latin1")).toBe("ftyp");
  });

  it("refuses anything over 3:00, whatever the browser said", async () => {
    const long = audio("long.webm", ["-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", "185", "-c:a", "libopus", "-b:a", "6k"]);
    await expect(processVoice(long)).rejects.toMatchObject({ name: "MediaInvalid", code: "too_long" });
  });

  it("refuses bytes that aren't audio", async () => {
    await expect(processVoice(Buffer.from("ID3 but not really an mp3 at all".repeat(50)))).rejects.toMatchObject({ code: "upload_failed" });
  });

  it("reads ffmpeg's duration line", () => {
    expect(parseDurationMs("  Duration: 00:01:12.48, start: 0.000000, bitrate: 64 kb/s")).toBe(72480);
    expect(parseDurationMs("Duration: N/A, bitrate: N/A")).toBeNull();
  });
});
