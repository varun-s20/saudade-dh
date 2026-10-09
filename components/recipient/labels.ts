/**
 * Recipient copy derived from the envelope's content: the extra words in each stamp's accessible
 * label (MASTER_BUILD_PROMPT §8: "Open voice message from Mira, 1 minute 12 seconds") and the
 * title of each stamp world. Names come from the letter (D-018). Pure.
 */
import type { ContentMap, StampKind } from "@/lib/services/types";
import { displayTrackTitle, plural, spokenDuration } from "@/lib/utils/format";

export function stampDetails(contents: ContentMap): Partial<Record<StampKind, string>> {
  const details: Partial<Record<StampKind, string>> = {};
  const photos = contents.photos?.content;
  if (photos && photos.items.length > 0) details.photos = plural(photos.items.length, "photo");
  const voice = contents.voice?.content;
  if (voice) details.voice = spokenDuration(voice.durationSec);
  const song = contents.song?.content;
  if (song) {
    const title = displayTrackTitle(song.title);
    details.song = song.artist?.trim() ? `${title} by ${song.artist.trim()}` : title;
  }
  return details;
}

/** The heading of a stamp's world (the sheet's dialog title). */
export function worldTitle(kind: StampKind, from: string | null): string {
  switch (kind) {
    case "photos":
      return from ? `Photos from ${from}` : "Photos for you";
    case "letter":
      return from ? `A letter from ${from}` : "A letter for you";
    case "voice":
      return from ? `A voice message from ${from}` : "A voice message";
    case "song":
      return from ? `A song from ${from}` : "A song for you";
  }
}

/** Local calendar date as "YYYY-MM-DD" (for postmarks). Call with a timestamp from an effect/useNow. */
export function localIsoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
