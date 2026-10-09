"use client";

import { useEffect, useState, type ReactNode } from "react";
import { STAMPS, accentVar } from "@/config/stamps";
import { services } from "@/lib/services";
import { STAMP_KINDS, type ContentMap, type PhotoItem, type StampKind } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { clock, dateTime, displayTrackTitle, plural, relativeTime } from "@/lib/utils/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdminButton, Card } from "./ui";

type Pending = { kind: StampKind; photo?: { item: PhotoItem; index: number } } | null;

/** Resolve a media id to a loadable URL (signed URL in production, IndexedDB/demo file here). */
function useMediaUrl(mediaId: string, variant?: "thumb" | "display"): string | null | undefined {
  const [url, setUrl] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void services.media.getUrl(mediaId, variant).then((u) => {
      if (alive) setUrl({ id: mediaId, url: u });
    });
    return () => {
      alive = false;
    };
  }, [mediaId, variant]);
  return url?.id === mediaId ? url.url : undefined;
}

/**
 * S23 content overview: what is inside each stamp, with remove (single photo or whole stamp)
 * behind a confirmation, for support cases. Admin removal is logged in the audit trail.
 */
export function UnitContent({ unitId, code, contents, now, onChanged }: { unitId: string; code: string; contents: ContentMap; now: number; onChanged: () => void }) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const filled = STAMP_KINDS.filter((k) => contents[k]).length;

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const res = await services.admin.removeContent(unitId, pending.kind, pending.photo?.item.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.error.code === "not_found" ? "That unit no longer exists" : "Couldn't remove it", {
        tone: "error",
        body: res.error.code === "network" ? "Check your connection and try again." : undefined,
      });
      return;
    }
    toast(pending.photo ? "Photo removed" : `${STAMPS[pending.kind].label} removed`, { tone: "success" });
    setPending(null);
    onChanged();
  };

  const what = pending?.photo ? `photo ${pending.photo.index + 1}` : pending ? `the ${STAMPS[pending.kind].label.toLowerCase()}` : "";

  return (
    <Card title="What’s inside" description={filled ? `${plural(filled, "stamp")} of 4 filled.` : "Nothing has been added yet."} bodyClassName="p-0">
      <ul className="divide-y divide-admin-line">
        {STAMP_KINDS.map((kind) => {
          const rec = contents[kind];
          return (
            <li key={kind} className="px-4 py-4 md:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium text-admin-ink">
                  <span aria-hidden className="size-2.5 rounded-paper" style={{ background: accentVar(STAMPS[kind].accent) }} />
                  {STAMPS[kind].label}
                  {rec && (
                    <span className="font-normal text-admin-ink-soft">
                      · v{rec.version} · updated {now ? relativeTime(rec.updatedAt, now) : dateTime(rec.updatedAt)}
                    </span>
                  )}
                </h3>
                {rec && (
                  <AdminButton tone="quiet" className="min-h-9 px-2.5 text-danger hover:text-danger pointer-fine:md:min-h-8" onClick={() => setPending({ kind })}>
                    {kind === "photos" ? "Remove all photos" : `Remove ${STAMPS[kind].label.toLowerCase()}`}
                  </AdminButton>
                )}
              </div>
              {!rec ? <p className="text-sm text-admin-ink-soft">Empty.</p> : <ContentBody kind={kind} contents={contents} onRemovePhoto={(item, index) => setPending({ kind: "photos", photo: { item, index } })} />}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        busy={busy}
        title={`Remove ${what}?`}
        confirmLabel={pending?.photo ? "Remove photo" : "Remove"}
        description={
          <>
            From <span className="font-postal tracking-wide">{code}</span>. The sender and the recipient will no longer see it. The removal is recorded in the
            audit log.
          </>
        }
      />
    </Card>
  );
}

function ContentBody({ kind, contents, onRemovePhoto }: { kind: StampKind; contents: ContentMap; onRemovePhoto: (item: PhotoItem, index: number) => void }) {
  if (kind === "photos" && contents.photos) {
    const items = contents.photos.content.items;
    return (
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label={`${items.length} photos`}>
        {items.map((p, i) => (
          <li key={p.id}>
            <PhotoThumb item={p} index={i} total={items.length} onRemove={() => onRemovePhoto(p, i)} />
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "letter" && contents.letter) {
    const l = contents.letter.content;
    return (
      <Excerpt>
        {l.to && <p className="mb-2">Dear {l.to},</p>}
        <p className="whitespace-pre-line">{l.body}</p>
        {(l.signoff || l.from) && (
          <p className="mt-3">
            {l.signoff}
            {l.signoff && l.from && <br />}
            {l.from}
          </p>
        )}
        <p className="mt-3 text-xs text-admin-ink-soft">{l.body.length.toLocaleString()} characters</p>
      </Excerpt>
    );
  }
  if (kind === "voice" && contents.voice) {
    return <VoiceRow mediaId={contents.voice.content.mediaId} duration={contents.voice.content.durationSec} source={contents.voice.content.source} mime={contents.voice.content.mime} />;
  }
  if (kind === "song" && contents.song) {
    const s = contents.song.content;
    return (
      <div className="flex items-center gap-3">
        {s.artworkUrl ? (
          // Remote provider artwork (metadata only); plain img keeps it out of the image optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.artworkUrl} alt="" width={56} height={56} className="size-14 rounded-soft object-cover shadow-flat" />
        ) : (
          <span aria-hidden className="size-14 rounded-pill bg-vinyl" />
        )}
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-admin-ink" title={s.title}>
            {displayTrackTitle(s.title)}
          </p>
          <p className="truncate text-admin-ink-soft">{s.artist}</p>
          <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-postmark underline underline-offset-2">
            Open on {s.provider === "spotify" ? "Spotify" : "Apple Music"}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    );
  }
  return null;
}

function Excerpt({ children }: { children: ReactNode }) {
  return <div className="max-h-64 overflow-y-auto rounded-soft border border-admin-line bg-paper-raised px-4 py-3 text-sm leading-relaxed text-admin-ink">{children}</div>;
}

function PhotoThumb({ item, index, total, onRemove }: { item: PhotoItem; index: number; total: number; onRemove: () => void }) {
  const url = useMediaUrl(item.mediaId, "thumb");
  const label = item.alt || item.caption || `Photo ${index + 1} of ${total}`;
  return (
    <figure className="group relative">
      <div className="aspect-square overflow-hidden rounded-soft border border-admin-line bg-admin-line/50">
        {url ? (
          // Blob / signed URLs: plain img, sized by the grid.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="size-full object-cover" loading="lazy" />
        ) : url === null ? (
          <span className="grid size-full place-items-center px-1 text-center text-xs text-admin-ink-soft">File missing</span>
        ) : (
          <span className="block size-full animate-pulse" aria-hidden />
        )}
      </div>
      {item.caption && <figcaption className="mt-1 line-clamp-2 text-xs text-admin-ink-soft">{item.caption}</figcaption>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove photo ${index + 1}`}
        className="absolute top-1 right-1 grid size-8 place-items-center rounded-pill bg-admin-surface/95 text-admin-ink shadow-stamp hover:text-danger pointer-coarse:size-11"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </figure>
  );
}

function VoiceRow({ mediaId, duration, source, mime }: { mediaId: string; duration: number; source: "recorded" | "uploaded"; mime: string }) {
  const url = useMediaUrl(mediaId);
  return (
    <div className="space-y-2">
      {url ? (
        <audio controls preload="none" src={url} className="w-full max-w-md">
          Your browser can’t play this audio.
        </audio>
      ) : url === null ? (
        <p className="text-sm text-danger">The audio file is missing.</p>
      ) : (
        <span className="block h-10 w-full max-w-md animate-pulse rounded-pill bg-admin-line/70" aria-hidden />
      )}
      <p className="text-xs text-admin-ink-soft">
        {clock(duration)} · {source === "recorded" ? "Recorded in the browser" : "Uploaded file"} · {mime.split(";")[0]}
      </p>
    </div>
  );
}
