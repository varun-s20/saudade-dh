/** Formatting helpers. Pure. */

/** 72 → "1:12" */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 72 → "1 minute 12 seconds" (for screen-reader labels) */
export function spokenDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (r || !m) parts.push(`${r} second${r === 1 ? "" : "s"}`);
  return parts.join(" ");
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Postmark date: "2026-10-08T…" → "08 OCT 2026". Read from the string itself (no Date, no
 * timezone shift), so server and client render the same text.
 */
export function postmarkDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso.toUpperCase();
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/** Friendly relative time for the sender/admin: "just now", "5 min ago", "yesterday", "3 Oct". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - Date.parse(iso);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Strip provider suffixes like " - Remastered 2009" for display on the vinyl label. */
export function displayTrackTitle(title: string): string {
  return title.replace(/\s+-\s+(\d{4}\s+)?(Remaster(ed)?|Mono|Stereo|Live|Single|Radio Edit)\b.*$/i, "").trim();
}
