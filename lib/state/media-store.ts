/**
 * Blob storage for the prototype (IndexedDB via idb-keyval). Production: Cloudflare R2 with
 * app-level versioning, served through short-lived signed CDN URLs (docs/ARCHITECTURE.md).
 *
 * Stored as { bytes: ArrayBuffer, type } rather than a Blob: WebKit in private/ephemeral
 * contexts (Safari Private Browsing, automated WebKit) refuses Blobs in IndexedDB but accepts
 * ArrayBuffers. Older records stored as Blobs are still read.
 */
import { createStore, del, get, set } from "idb-keyval";

interface StoredMedia {
  bytes: ArrayBuffer;
  type: string;
}

const store = typeof indexedDB !== "undefined" ? createStore("saudade-media", "blobs") : undefined;
const urlCache = new Map<string, string>();

export async function putBlob(id: string, blob: Blob): Promise<void> {
  if (!store) throw new Error("IndexedDB unavailable");
  const record: StoredMedia = { bytes: await blob.arrayBuffer(), type: blob.type };
  await set(id, record, store);
}

export async function getBlobUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  if (!store) return null;
  const value = await get<StoredMedia | Blob>(id, store);
  if (!value) return null;
  const blob = value instanceof Blob ? value : new Blob([value.bytes], { type: value.type });
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteBlob(id: string): Promise<void> {
  const cached = urlCache.get(id);
  if (cached) URL.revokeObjectURL(cached);
  urlCache.delete(id);
  if (store) await del(id, store);
}

export async function clearBlobs(): Promise<void> {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  if (!store) return;
  const { clear } = await import("idb-keyval");
  await clear(store);
}
