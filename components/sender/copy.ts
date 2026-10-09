/**
 * Sender portal copy that is shared between screens. Voice: warm, brief, second person.
 * Error copy is plain and clear (no postal metaphors), keyed by ServiceErrorCode.
 */
import type { ContentMap, ServiceError, StampKind } from "@/lib/services/types";
import { clock, displayTrackTitle, plural } from "@/lib/utils/format";

/** The success toast after every explicit Save (S12). */
export const SAVED_TOAST = "Sealed with care";

/** Generic "couldn't save" text for a failed save/remove, by error code. */
export function saveErrorText(err: ServiceError): string {
  switch (err.code) {
    case "network":
      return "We couldn't save just now. Check your connection, then try again. Nothing was lost.";
    case "not_found":
    case "unauthorized":
      return "This link isn't active any more. Claim your code again, or ask us to email you your link.";
    case "upload_failed":
      return "The upload didn't finish. Check your connection, then try again.";
    case "too_large":
      return "That file is too large to upload.";
    case "too_long":
      return "That recording is longer than 3 minutes.";
    case "invalid_input":
      return "Something in there isn't quite right. Check it, then try again.";
    default:
      return "Something went wrong while saving. Try again in a moment.";
  }
}

/** Short summary of a filled stamp for the portal slot ("6 photos", "182 words", "1:08", the song). */
export function stampSummary(kind: StampKind, contents: ContentMap): string | null {
  switch (kind) {
    case "photos": {
      const n = contents.photos?.content.items.length ?? 0;
      return n ? plural(n, "photo") : null;
    }
    case "letter": {
      const body = contents.letter?.content.body.trim();
      if (!body) return null;
      return plural(body.split(/\s+/).filter(Boolean).length, "word");
    }
    case "voice": {
      const v = contents.voice?.content;
      return v ? clock(v.durationSec) : null;
    }
    case "song": {
      const s = contents.song?.content;
      return s ? displayTrackTitle(s.title) : null;
    }
  }
}

/** Screen-reader version of the summary ("6 photos", "182 words", "1 minute 8 seconds", "Here Comes the Sun by The Beatles"). */
export function stampSummarySpoken(kind: StampKind, contents: ContentMap): string | null {
  if (kind === "voice") {
    const v = contents.voice?.content;
    if (!v) return null;
    const s = Math.round(v.durationSec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return [m ? plural(m, "minute") : "", r || !m ? plural(r, "second") : ""].filter(Boolean).join(" ");
  }
  if (kind === "song") {
    const s = contents.song?.content;
    return s ? `${stampSummary("song", contents)}${s.artist ? ` by ${s.artist}` : ""}` : null;
  }
  return stampSummary(kind, contents);
}

/** "Opened on 8 Oct" style day + month, in the viewer's own calendar. Client-only data, so no SSR mismatch. */
export function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
