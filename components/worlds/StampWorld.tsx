"use client";

/**
 * The four stamp worlds, each lazy-loaded (next/dynamic, client only) so the recipient route's
 * first load carries only the envelope. `prefetchWorlds` warms the chunks for the stamps that are
 * on the envelope once it has settled, so a tap still opens instantly.
 */
import dynamic from "next/dynamic";
import type { RecipientEnvelope, StampKind } from "@/lib/services/types";

const loaders = {
  photos: () => import("./PhotosWorld"),
  letter: () => import("./LetterWorld"),
  voice: () => import("./VoiceWorld"),
  song: () => import("./SongWorld"),
} as const;

/** Quiet space while a world's code arrives (the sheet's paper is already there). */
function WorldLoading() {
  return (
    <div className="grid min-h-[60svh] place-items-center" aria-busy="true">
      <span className="sr-only" role="status">
        Opening…
      </span>
    </div>
  );
}

const PhotosWorld = dynamic(() => loaders.photos().then((m) => m.PhotosWorld), { ssr: false, loading: WorldLoading });
const LetterWorld = dynamic(() => loaders.letter().then((m) => m.LetterWorld), { ssr: false, loading: WorldLoading });
const VoiceWorld = dynamic(() => loaders.voice().then((m) => m.VoiceWorld), { ssr: false, loading: WorldLoading });
const SongWorld = dynamic(() => loaders.song().then((m) => m.SongWorld), { ssr: false, loading: WorldLoading });

export function prefetchWorlds(kinds: readonly StampKind[]): void {
  for (const k of kinds) void loaders[k]().catch(() => undefined);
}

export interface StampWorldProps {
  kind: StampKind;
  env: RecipientEnvelope;
  fromName: string | null;
  /** Write the letter out as it opens (its first reading on this device). */
  typeLetter?: boolean;
  /** The letter has been written out (or the reader skipped ahead). */
  onLetterTyped?: () => void;
}

export function StampWorld({ kind, env, fromName, typeLetter, onLetterTyped }: StampWorldProps) {
  const c = env.contents;
  switch (kind) {
    case "photos":
      return c.photos ? <PhotosWorld photos={c.photos.content} fromName={fromName} /> : <Gone />;
    case "letter":
      return c.letter ? <LetterWorld letter={c.letter.content} writtenAt={c.letter.updatedAt} typeOut={typeLetter} onTyped={onLetterTyped} /> : <Gone />;
    case "voice":
      return c.voice ? <VoiceWorld voice={c.voice.content} fromName={fromName} /> : <Gone />;
    case "song":
      return c.song ? <SongWorld key={`${c.song.content.provider}:${c.song.content.trackId}`} song={c.song.content} fromName={fromName} /> : <Gone />;
  }
}

/** The sender removed this stamp while it was open (content refreshed underneath). */
function Gone() {
  return <p className="px-6 py-12 text-center text-lg font-medium text-ink-soft">This part of the envelope has been taken out for now.</p>;
}
