"use client";

/**
 * S8 · Photos editor. Up to 15 snapshots tucked into the envelope.
 *
 * Each picked file is compressed for real on the device (photo-processing.ts), measured, then
 * uploaded through services.media.upload, with one ProgressStamp per photo covering both phases
 * (the print "develops" as it uploads). Two photos are processed at a time to stay gentle on
 * phone memory. Captions are optional [PROPOSED]. No drag-to-reorder (deferred).
 *
 * The draft only reaches the envelope on Save (PhotosContent via services.content.save; saving
 * with every photo removed takes the stamp off). Removed media are deleted after the save
 * succeeds; uploads made this session are deleted if the draft is discarded (best-effort).
 */
import { useEffect, useRef, useState } from "react";
import { FieldCounter } from "@/components/forms/StampedInput";
import { StampedTextarea } from "@/components/forms/StampedTextarea";
import { UploadTile } from "@/components/forms/UploadTile";
import { PhotoMount } from "@/components/media/PhotoMount";
import { InkButton } from "@/components/ui/InkButton";
import { ProgressStamp } from "@/components/ui/ProgressStamp";
import { IconClose, IconRefresh, IconWarning } from "@/components/ui/icons";
import { STAMPS } from "@/config/stamps";
import { site } from "@/config/site";
import { generateId } from "@/lib/parsing/codes";
import { services } from "@/lib/services";
import type { PhotoItem, SenderEnvelope } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { plural } from "@/lib/utils/format";
import { SAVED_TOAST, saveErrorText } from "./copy";
import { compressPhoto, isHeic, looksLikePhoto, PHOTO_LIMIT, PhotoDecodeError, tooLargeToTry } from "./photo-processing";
import { RemoveStamp } from "./RemoveStamp";
import { SaveDock, type SaveTone } from "./SaveDock";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell, UnsavedGuard } from "./SenderShell";
import { useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";

const TITLE = STAMPS.photos.sender.editorTitle;
const CAPTION_MAX = site.limits.photoCaptionChars;
const CAPTION_COUNTER_FROM = Math.round(CAPTION_MAX * 0.8);
const CONCURRENCY = 2;
/** Share of the ring for the compress phase; the upload fills the rest. */
const COMPRESS_SHARE = 0.35;

type Status = "ready" | "queued" | "compressing" | "uploading" | "failed";

interface Item {
  /** Local key (stable for React and the processing queue). */
  key: string;
  /** PhotoItem id. */
  id: string;
  mediaId?: string;
  width: number;
  height: number;
  caption: string;
  alt?: string;
  status: Status;
  /** 0..1 progress of the current phase. */
  progress: number;
  previewUrl?: string;
  error?: { title: string; why: string; canRetry: boolean };
  /** Uploaded during this editing session (not in the saved envelope yet). */
  fresh: boolean;
}

const fromSaved = (p: PhotoItem): Item => ({
  key: p.id,
  id: p.id,
  mediaId: p.mediaId,
  width: p.width,
  height: p.height,
  caption: p.caption ?? "",
  alt: p.alt,
  status: "ready",
  progress: 1,
  fresh: false,
});

const toSaved = (i: Item): PhotoItem => ({
  id: i.id,
  mediaId: i.mediaId as string,
  width: i.width,
  height: i.height,
  caption: i.caption.trim() || undefined,
  alt: i.alt,
});

function sameAsSaved(items: Item[], saved: PhotoItem[]): boolean {
  if (items.length !== saved.length) return false;
  return items.every((it, n) => it.status === "ready" && it.id === saved[n].id && it.caption.trim() === (saved[n].caption ?? ""));
}

/** A slight, deterministic tilt per position, like prints tucked in by hand. */
const tilt = (n: number) => [-1.6, 1.2, 0.8, -1.1, 1.5, -0.7][n % 6];

export function PhotosEditor() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  if (q.status !== "success") {
    return (
      <SenderShell token={token} title={TITLE} kind="photos">
        <EnvelopeGate query={q} reload={() => q.reload()}>
          {() => null}
        </EnvelopeGate>
      </SenderShell>
    );
  }
  return <PhotosBody token={token} env={q.data} refresh={() => q.reload(true)} />;
}

function PhotosBody({ token, env, refresh }: { token: string; env: SenderEnvelope; refresh: () => void }) {
  const record = env.contents.photos;
  const savedItems = record?.content.items ?? [];

  const [baseline, setBaseline] = useState<PhotoItem[]>(savedItems);
  const [items, setItems] = useState<Item[]>(() => savedItems.map(fromSaved));
  const [syncedVersion, setSyncedVersion] = useState(record?.version ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Async work needs the latest blobs/files without stale closures.
  const files = useRef(new Map<string, { file: File; blob?: Blob }>());
  const ownedUrls = useRef(new Map<string, string>());
  const cancelled = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterRemove = useRef<string | "tile" | null>(null);
  const tileId = "photos-upload";
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  const dirty = !sameAsSaved(items, baseline);

  // Saved elsewhere while nothing is pending here: take the newer envelope.
  const remoteVersion = record?.version ?? 0;
  if (remoteVersion !== syncedVersion && !dirty && !saving) {
    setSyncedVersion(remoteVersion);
    setBaseline(savedItems);
    setItems(savedItems.map(fromSaved));
  }

  // Resolve display URLs for saved photos (static demo files or IndexedDB blobs).
  useEffect(() => {
    let live = true;
    const missing = items.filter((i) => i.status === "ready" && !i.previewUrl && i.mediaId);
    for (const it of missing) {
      void services.media.getUrl(it.mediaId as string, "thumb").then((url) => {
        if (!live || !url) return;
        setItems((xs) => xs.map((x) => (x.key === it.key ? { ...x, previewUrl: url } : x)));
      });
    }
    return () => {
      live = false;
    };
  }, [items]);

  // Move focus somewhere sensible after a photo is removed.
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (!target) return;
    focusAfterRemove.current = null;
    if (target === "tile") document.getElementById(tileId)?.focus();
    else removeButtons.current.get(target)?.focus();
  }, [items]);

  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const dropOwnedUrl = (key: string) => {
    const url = ownedUrls.current.get(key);
    if (url) URL.revokeObjectURL(url);
    ownedUrls.current.delete(key);
  };

  // ── Processing queue ───────────────────────────────────────────────────
  const upload = async (key: string, blob: Blob, width: number, height: number) => {
    patch(key, { status: "uploading", progress: 0, error: undefined });
    const res = await services.media.upload(token, blob, { kind: "photo", mime: blob.type || "image/jpeg", bytes: blob.size, width, height }, (f) => {
      if (!cancelled.current.has(key)) patch(key, { progress: f });
    });
    if (cancelled.current.has(key)) {
      if (res.ok) void services.media.remove(token, res.data.id);
      return;
    }
    if (!res.ok) {
      const tooBig = res.error.code === "too_large";
      patch(key, {
        status: "failed",
        error: {
          title: tooBig ? "Too large to send" : "Didn't upload",
          why: tooBig ? "Even after shrinking, this one is too big. Try another photo." : res.error.code === "not_found" ? "This link isn't active any more." : "Check your connection, then try again.",
          canRetry: !tooBig && res.error.code !== "not_found",
        },
      });
      return;
    }
    patch(key, { status: "ready", progress: 1, mediaId: res.data.id });
  };

  const process = async (key: string) => {
    const entry = files.current.get(key);
    if (!entry || cancelled.current.has(key)) return;
    try {
      let blob = entry.blob;
      let width = 0;
      let height = 0;
      if (!blob) {
        patch(key, { status: "compressing", progress: 0, error: undefined });
        const out = await compressPhoto(entry.file, (f) => {
          if (!cancelled.current.has(key)) patch(key, { progress: f });
        });
        if (cancelled.current.has(key)) return;
        blob = out.blob;
        width = out.width;
        height = out.height;
        entry.blob = blob;
        const url = URL.createObjectURL(blob);
        ownedUrls.current.set(key, url);
        patch(key, { width, height, previewUrl: url });
      } else {
        const it = itemsRef.current.find((x) => x.key === key);
        width = it?.width ?? 0;
        height = it?.height ?? 0;
      }
      await upload(key, blob, width, height);
    } catch (err) {
      if (cancelled.current.has(key)) return;
      const heic = err instanceof PhotoDecodeError ? err.heic : isHeic(entry.file);
      patch(key, {
        status: "failed",
        error: {
          title: "We couldn't open this photo",
          why: heic
            ? "This browser can't read HEIC photos. Try again from Safari on your iPhone, or save it as a JPEG first."
            : "It may be damaged or in an unusual format. Try another photo.",
          canRetry: false,
        },
      });
    }
  };

  const pump = () => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const key = queue.current.shift() as string;
      active.current += 1;
      void process(key).finally(() => {
        active.current -= 1;
        pump();
      });
    }
  };

  // ── Adding ─────────────────────────────────────────────────────────────
  const onFiles = (picked: File[]) => {
    const room = PHOTO_LIMIT - items.length;
    const photos = picked.filter(looksLikePhoto);
    const notPhotos = picked.length - photos.length;
    const usable = photos.filter((f) => !tooLargeToTry(f));
    const huge = photos.length - usable.length;
    const take = usable.slice(0, Math.max(0, room));
    const left = usable.length - take.length;

    const added: Item[] = take.map((file) => {
      const key = generateId("pick");
      files.current.set(key, { file });
      queue.current.push(key);
      return { key, id: generateId("photo"), width: 4, height: 5, caption: "", status: "queued", progress: 0, fresh: true };
    });
    if (added.length) setItems((xs) => [...xs, ...added]);

    const parts: string[] = [];
    if (left > 0) {
      parts.push(`You picked ${usable.length}, and there was room for ${take.length}, so we added the first ${take.length === 1 ? "one" : take.length}. An envelope holds ${PHOTO_LIMIT}.`);
    } else if (added.length) {
      parts.push(`Adding ${plural(added.length, "photo")}.`);
    }
    if (notPhotos > 0) parts.push(`${plural(notPhotos, "file")} ${notPhotos === 1 ? "wasn't a photo" : "weren't photos"}, so we left ${notPhotos === 1 ? "it" : "them"} out.`);
    if (huge > 0) parts.push(`${plural(huge, "photo")} ${huge === 1 ? "is" : "are"} over ${site.limits.photoInputMaxMB} MB, so we left ${huge === 1 ? "it" : "them"} out.`);
    setNotice(parts.join(" ") || null);
    setSaveError(null);
    pump();
  };

  // ── Removing / retrying ────────────────────────────────────────────────
  const remove = (key: string) => {
    const n = items.findIndex((x) => x.key === key);
    const it = items[n];
    if (!it) return;
    if (it.status === "queued" || it.status === "compressing" || it.status === "uploading") cancelled.current.add(key);
    queue.current = queue.current.filter((k) => k !== key);
    if (it.fresh && it.mediaId) void services.media.remove(token, it.mediaId);
    dropOwnedUrl(key);
    files.current.delete(key);
    const next = items[n + 1] ?? items[n - 1];
    focusAfterRemove.current = next ? next.key : "tile";
    setItems((xs) => xs.filter((x) => x.key !== key));
    setNotice(`Photo ${n + 1} taken out.`);
    setSaveError(null);
  };

  const retry = (key: string) => {
    cancelled.current.delete(key);
    queue.current.push(key);
    patch(key, { status: "queued", progress: 0, error: undefined });
    pump();
  };

  // ── Discard / save ─────────────────────────────────────────────────────
  const discard = () => {
    for (const it of items) {
      if (it.status === "queued" || it.status === "compressing" || it.status === "uploading") cancelled.current.add(it.key);
      if (it.fresh && it.mediaId) void services.media.remove(token, it.mediaId);
      if (it.fresh) dropOwnedUrl(it.key);
    }
    queue.current = [];
    setItems(baseline.map(fromSaved));
    setNotice(null);
    setSaveError(null);
  };

  const pending = items.filter((i) => i.status === "queued" || i.status === "compressing" || i.status === "uploading").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const canSave = dirty && pending === 0 && failed === 0 && !saving && (items.length > 0 || Boolean(record));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const ready = items.filter((i) => i.status === "ready" && i.mediaId);
    const next = ready.map(toSaved);
    const res = next.length ? await services.content.save(token, { kind: "photos", items: next }) : await services.content.remove(token, "photos");
    setSaving(false);
    if (!res.ok) {
      const msg = saveErrorText(res.error);
      setSaveError(msg);
      toast("Your photos didn't save", { tone: "error", body: msg });
      return;
    }
    // Clean up media that left the envelope (best-effort; production keeps them 90 days).
    const kept = new Set(next.map((p) => p.mediaId));
    for (const p of baseline) if (!kept.has(p.mediaId)) void services.media.remove(token, p.mediaId);
    setBaseline(next);
    setItems((xs) => xs.map((x) => ({ ...x, fresh: false, caption: x.caption.trim() })));
    setSyncedVersion("version" in res.data ? res.data.version : 0);
    setNotice(null);
    toast(SAVED_TOAST, { tone: "success", body: next.length ? `${plural(next.length, "photo")} in the envelope.` : "The photos stamp is off the envelope." });
    refresh();
  };

  // ── Status line ────────────────────────────────────────────────────────
  let status: string;
  let tone: SaveTone = "neutral";
  if (saving) {
    status = "Saving…";
    tone = "busy";
  } else if (pending) {
    status = `Tucking in ${plural(pending, "photo")}…`;
    tone = "busy";
  } else if (failed) {
    status = `${plural(failed, "photo")} didn't make it. Retry or remove ${failed === 1 ? "it" : "them"}.`;
    tone = "error";
  } else if (saveError) {
    status = "Didn't save. Try again.";
    tone = "error";
  } else if (dirty && items.length === 0) {
    status = "All photos out. Save to take the stamp off.";
    tone = "dirty";
  } else if (dirty) {
    status = "Unsaved changes";
    tone = "dirty";
  } else if (record) {
    status = "Saved";
    tone = "saved";
  } else {
    status = "Nothing to save yet";
  }

  const full = items.length >= PHOTO_LIMIT;
  const room = PHOTO_LIMIT - items.length;

  return (
    <SenderShell token={token} title={TITLE} kind="photos" lede={<>Up to {PHOTO_LIMIT} moments, tucked into the envelope. We&apos;ll make each one light enough for their phone.</>} dock={<SaveDock status={status} tone={tone} canSave={canSave} saving={saving} onSave={save} />}>
      <UnsavedGuard dirty={dirty} onDiscard={discard} />

      <div className="mt-5 flex items-baseline justify-between gap-4">
        <p className="postal-label text-ink-soft">In the envelope</p>
        <p className="font-postal text-xl tracking-wider text-ink" aria-label={`${items.length} of ${PHOTO_LIMIT} photos`}>
          {items.length} / {PHOTO_LIMIT}
        </p>
      </div>

      <UploadTile
        id={tileId}
        className="mt-2"
        accept="image/*"
        multiple
        onFiles={onFiles}
        limitReached={full}
        label={items.length ? "Add more photos" : "Add photos"}
        hint={full ? `${PHOTO_LIMIT} is the most an envelope holds. Take one out to add another.` : `Room for ${plural(room, "more", "more")} · JPG, PNG or HEIC`}
        limitLabel="That's a full envelope"
      />

      <p className="ss-parse mt-3" aria-live="polite">
        {notice}
      </p>

      {items.length > 0 ? (
        <ul className="ss-photo-grid" aria-label="Photos in the envelope">
          {items.map((it, n) => (
            <li key={it.key} className="ss-photo">
              <div className="ss-photo__frame">
                {it.status === "ready" && it.previewUrl ? (
                  <PhotoMount src={it.previewUrl} alt={it.caption.trim() || `Photo ${n + 1} of ${items.length}`} width={it.width} height={it.height} rotate={tilt(n)} />
                ) : (
                  <PendingPrint item={it} n={n} onRetry={() => retry(it.key)} />
                )}
                <button
                  type="button"
                  className="ss-photo__remove"
                  aria-label={`Take out photo ${n + 1}`}
                  onClick={() => remove(it.key)}
                  ref={(el) => {
                    if (el) removeButtons.current.set(it.key, el);
                    else removeButtons.current.delete(it.key);
                  }}
                >
                  <IconClose size={18} strokeWidth={2} />
                </button>
              </div>
              {it.status === "ready" ? (
                <StampedTextarea
                  className="ss-caption mt-2"
                  label={`Caption for photo ${n + 1} (optional)`}
                  hideLabel
                  font="hand"
                  rows={1}
                  autoGrow
                  value={it.caption}
                  maxLength={CAPTION_MAX}
                  placeholder="Add a caption"
                  onChange={(e) => patch(it.key, { caption: e.target.value.replace(/\n/g, " ") })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  enterKeyHint="done"
                  counter={it.caption.length >= CAPTION_COUNTER_FROM ? <FieldCounter count={it.caption.length} max={CAPTION_MAX} /> : undefined}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {record ? (
        <RemoveStamp
          token={token}
          kind="photos"
          status={env.unit.status}
          onRemoved={() => {
            for (const it of items) {
              if (it.mediaId) void services.media.remove(token, it.mediaId);
              dropOwnedUrl(it.key);
            }
            for (const p of baseline) void services.media.remove(token, p.mediaId);
            queue.current = [];
            setBaseline([]);
            setItems([]);
          }}
        />
      ) : null}
    </SenderShell>
  );
}

function PendingPrint({ item, n, onRetry }: { item: Item; n: number; onRetry: () => void }) {
  const compressing = item.status === "compressing";
  const queued = item.status === "queued";
  // Compression reports progress in steps; until the first one, the ring circles (indeterminate).
  const value = queued
    ? 0
    : compressing
      ? item.progress > 0
        ? item.progress * COMPRESS_SHARE
        : undefined
      : item.status === "uploading"
        ? COMPRESS_SHARE + item.progress * (1 - COMPRESS_SHARE)
        : 1;
  const develop = item.status === "uploading" ? 0.2 + item.progress * 0.6 : item.status === "ready" ? 1 : 0.2;

  return (
    <div className="ss-photo__pending" style={{ ["--develop" as string]: develop }}>
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL of the compressed photo
        <img className="ss-photo__ghost" src={item.previewUrl} alt="" aria-hidden />
      ) : null}
      {item.status === "failed" && item.error ? (
        <div className="ss-photo__failed" role="alert">
          <IconWarning size={22} />
          <p className="font-medium">{item.error.title}</p>
          <p className="ss-photo__why">{item.error.why}</p>
          {item.error.canRetry ? (
            <InkButton variant="secondary" onClick={onRetry} icon={<IconRefresh size={16} />} className="mt-1" aria-label={`Retry photo ${n + 1}`}>
              Retry
            </InkButton>
          ) : null}
        </div>
      ) : (
        <ProgressStamp
          className="ss-photo__progress"
          value={value}
          size={72}
          showValue={!queued}
          label={queued ? "Waiting its turn…" : compressing ? "Making it lighter…" : item.status === "uploading" ? "Tucking it in…" : "Ready"}
          ink="terracotta"
        />
      )}
    </div>
  );
}
