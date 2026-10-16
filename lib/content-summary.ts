/** One plain line describing a saved stamp (admin history lists). Pure; server and browser. */
import type { StampContent } from "@/lib/services/types";

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function summarise(c: StampContent): string {
  switch (c.kind) {
    case "photos":
      return `${c.items.length} photo${c.items.length === 1 ? "" : "s"}`;
    case "letter":
      return `Letter${c.to ? ` to ${c.to}` : ""}, ${c.body.length.toLocaleString("en")} characters`;
    case "voice":
      return `Voice note, ${clock(c.durationSec)}`;
    case "song":
      return `Song: ${c.title}${c.artist ? ` · ${c.artist}` : ""}`;
  }
}
