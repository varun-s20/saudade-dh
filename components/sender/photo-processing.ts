/**
 * Photo pipeline for the sender's Photos editor (S8): REAL client-side compression with
 * browser-image-compression (longest edge ≤ site.limits.photoMaxEdge, ≈ site.limits.photoTargetMB,
 * in a Web Worker), then the real pixel size of the result. Everything leaves as JPEG: HEIC from
 * iPhones is converted when the browser can decode it (Safari can; most others can't), and PNG
 * screenshots shrink far better as JPEG (transparency is flattened onto white by the library).
 *
 * The worker script is self-hosted (`/public/vendor`, MIT licence, see docs/ASSETS.md) so no
 * third-party CDN is contacted; if the worker can't start the library falls back to the main thread.
 */
import { site } from "@/config/site";

export const PHOTO_LIMIT = site.limits.photos;
const INPUT_MAX_BYTES = site.limits.photoInputMaxMB * 1024 * 1024;

export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export function looksLikePhoto(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

export function tooLargeToTry(file: File): boolean {
  return file.size > INPUT_MAX_BYTES;
}

export class PhotoDecodeError extends Error {
  constructor(public heic: boolean) {
    super(heic ? "heic_decode" : "decode");
  }
}

/** Natural pixel size of an image blob. */
export async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close();
      if (size.width && size.height) return size;
    } catch {
      // fall through to <img>
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("measure"));
    };
    img.src = url;
  });
}

/**
 * Compress one photo. `onProgress` gets 0..1. Throws PhotoDecodeError when the browser cannot
 * read the image (typically HEIC outside Safari).
 */
export async function compressPhoto(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; width: number; height: number }> {
  const heic = isHeic(file);
  const { default: imageCompression } = await import("browser-image-compression");
  let out: Blob;
  try {
    out = await imageCompression(file, {
      maxWidthOrHeight: site.limits.photoMaxEdge,
      maxSizeMB: site.limits.photoTargetMB,
      useWebWorker: true,
      libURL: "/vendor/browser-image-compression-2.0.2.js",
      fileType: "image/jpeg",
      initialQuality: 0.86,
      onProgress: (p) => onProgress(Math.min(1, Math.max(0, p / 100))),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new PhotoDecodeError(heic);
  }
  try {
    const { width, height } = await measure(out);
    return { blob: out, width, height };
  } catch {
    throw new PhotoDecodeError(heic);
  }
}
