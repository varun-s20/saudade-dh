/**
 * STAMP ASSET MAP: the single source for stamp artwork, colour, labels and motifs.
 *
 * When the client's artwork arrives (OPEN_QUESTIONS O4: SVG, or transparent PNG @2x/@3x):
 *   1. Drop the files in /public/stamps/ (keep the placeholders for reference).
 *   2. Point `art.src` (and `art.width`/`art.height`, the artwork's intrinsic aspect) at them.
 *   3. Set `art.placeholder = false`, which removes the "PLACEHOLDER" marking everywhere.
 * Nothing else in the codebase should reference stamp art paths.
 */
import type { StampKind } from "@/lib/services/types";

/** Token names (styles/tokens.css) usable as a stamp accent. */
export type AccentToken = "terracotta" | "dusty-blue" | "sage" | "rose" | "red" | "ochre";

export interface StampArt {
  src: string;
  width: number;
  height: number;
  placeholder: boolean;
}

export interface StampDefinition {
  kind: StampKind;
  /** Short name shown to senders and recipients. */
  label: string;
  /** Postal-style caption printed on the stamp ("No. 1 · Photographs"). */
  denomination: string;
  accent: AccentToken;
  art: StampArt;
  /** The "world" the opened view is built around (MASTER_BUILD_PROMPT §6.3 C.17). */
  motif: "snapshot" | "stationery" | "radio" | "vinyl";
  /** Text on the cancellation postmark that lands on this stamp during the reveal. */
  postmark: string;
  /** Resting placement on the envelope face, % of envelope width/height, and rotation (deg). */
  place: { x: number; y: number; rotate: number };
  sender: {
    /** Sender portal slot copy. */
    emptyTitle: string;
    emptyHint: string;
    editorTitle: string;
  };
  recipient: {
    /** Screen-reader label for the stamp button; `from` is the sender's name if known. */
    openLabel: (p: { from: string | null; detail?: string }) => string;
  };
}

const by = (from: string | null) => (from ? ` from ${from}` : "");

export const STAMPS: Record<StampKind, StampDefinition> = {
  photos: {
    kind: "photos",
    label: "Photos",
    denomination: "No. 1 · Photographs",
    accent: "terracotta",
    art: { src: "/placeholders/stamps/photos.svg", width: 240, height: 300, placeholder: true },
    motif: "snapshot",
    postmark: "SNAPSHOTS",
    place: { x: 8, y: 12, rotate: -4 },
    sender: {
      emptyTitle: "Photos",
      emptyHint: "Up to 15 moments, tucked into the envelope.",
      editorTitle: "Photos",
    },
    recipient: {
      openLabel: ({ from, detail }) => `Open photos${by(from)}${detail ? `, ${detail}` : ""}`,
    },
  },
  letter: {
    kind: "letter",
    label: "Letter",
    denomination: "No. 2 · Correspondence",
    accent: "dusty-blue",
    art: { src: "/placeholders/stamps/letter.svg", width: 240, height: 300, placeholder: true },
    motif: "stationery",
    postmark: "BY HAND",
    place: { x: 55, y: 7, rotate: 3 },
    sender: {
      emptyTitle: "Letter",
      emptyHint: "Write it the way you'd say it.",
      editorTitle: "Your letter",
    },
    recipient: {
      openLabel: ({ from }) => `Open letter${by(from)}`,
    },
  },
  voice: {
    kind: "voice",
    label: "Voice",
    denomination: "No. 3 · Wireless",
    accent: "sage",
    art: { src: "/placeholders/stamps/voice.svg", width: 240, height: 300, placeholder: true },
    motif: "radio",
    postmark: "ON THE AIR",
    place: { x: 11, y: 52, rotate: 2 },
    sender: {
      emptyTitle: "Voice",
      emptyHint: "Up to three minutes, in your own voice.",
      editorTitle: "Voice message",
    },
    recipient: {
      openLabel: ({ from, detail }) => `Open voice message${by(from)}${detail ? `, ${detail}` : ""}`,
    },
  },
  song: {
    kind: "song",
    label: "Song",
    denomination: "No. 4 · Gramophone",
    accent: "ochre",
    art: { src: "/placeholders/stamps/song.svg", width: 240, height: 300, placeholder: true },
    motif: "vinyl",
    postmark: "NOW PLAYING",
    place: { x: 56, y: 50, rotate: -3 },
    sender: {
      emptyTitle: "Song",
      emptyHint: "One song that sounds like the two of you.",
      editorTitle: "A song for them",
    },
    recipient: {
      openLabel: ({ from, detail }) => `Open song${by(from)}${detail ? `: ${detail}` : ""}`,
    },
  },
};

/** The heart stamp: mirrors the NFC tap zone on the ceramic. Used as the envelope's wax seal. */
export const HEART_SEAL: StampArt = {
  src: "/placeholders/stamps/heart-seal.svg",
  width: 200,
  height: 200,
  placeholder: true,
};

export const PLACEHOLDER_LABEL = "PLACEHOLDER · client artwork pending";

/**
 * Each stamp's "world" colour field (Lisbon Post): the pastel ground its cards, editor header and
 * opened view sit on. Ink text on every fill is ≥ 7:1.
 */
export const WORLD_FILL: Record<StampKind, string> = {
  photos: "color-mix(in srgb, var(--accent-terracotta) 55%, var(--paper-raised))",
  letter: "var(--accent-dusty-blue)",
  voice: "var(--accent-sage)",
  song: "var(--accent-ochre)",
};

/** CSS variable for a stamp's accent: fill colour and its text-safe "-ink" partner. */
export const accentVar = (a: AccentToken) => `var(--accent-${a})`;
export const accentInkVar = (a: AccentToken) => `var(--accent-${a}-ink)`;
