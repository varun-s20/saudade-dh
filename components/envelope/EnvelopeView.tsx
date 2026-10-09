"use client";

/**
 * <EnvelopeView>: the recipient's settled, interactive envelope. Used for repeat visits (opens
 * calmly, no ceremony) and is visually identical to the last frame of <FirstTapReveal>.
 *
 * - Only the stamps in `kinds` appear (an empty slot would read as missing love).
 * - `newKinds` get a small NEW postmark (device-local, D-017).
 * - Each stamp is a real <button> labelled from config/stamps.ts `openLabel`
 *   ("Open voice message from Mira, 1 minute 12 seconds" when `details.voice` is given).
 * - `onOpenStamp(kind, originRect, button)`: pass `originRect` to <Sheet> so the stamp's world
 *   grows out of the stamp; focus returns to `button` when the sheet closes.
 */
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { EnvelopeBoard, DEFAULT_HINT } from "./EnvelopeBoard";

export interface EnvelopeViewProps {
  /** Stamps with content, in any order (rendered in envelope order). */
  kinds: readonly StampKind[];
  /** Stamps updated since this device's last visit. */
  newKinds?: ReadonlySet<StampKind>;
  toName?: string | null;
  fromName?: string | null;
  /** ISO date for the postmarks (e.g. when the envelope was sealed). */
  postmarkDate?: string | null;
  /** Extra words for each stamp's accessible label (e.g. voice: "1 minute 12 seconds"). */
  details?: Partial<Record<StampKind, string>>;
  /** Default "Tap a stamp to open it."; null hides it. */
  hint?: string | null;
  /** "calm" (default): a soft < 600 ms fade/settle. "none": already on screen (after the reveal). */
  entrance?: "calm" | "none";
  onOpenStamp: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
  /** Fill the parent box instead of the viewport (sender preview frame, playground). */
  contained?: boolean;
  className?: string;
}

export function EnvelopeView({
  kinds,
  newKinds,
  toName,
  fromName,
  postmarkDate,
  details,
  hint = DEFAULT_HINT,
  entrance = "calm",
  onOpenStamp,
  contained,
  className,
}: EnvelopeViewProps) {
  const reduced = useReducedMotionPref();
  return (
    <EnvelopeBoard
      kinds={orderKinds(kinds)}
      newKinds={newKinds}
      toName={toName}
      fromName={fromName}
      postmarkDate={postmarkDate}
      details={details}
      hint={hint}
      entrance={entrance}
      reduced={reduced}
      contained={contained}
      onOpenStamp={onOpenStamp}
      className={className}
    />
  );
}

/** Stamps in envelope order (photos, letter, voice, song), whatever order they were passed in. */
export function orderKinds(kinds: readonly StampKind[]): StampKind[] {
  return STAMP_KINDS.filter((k) => kinds.includes(k));
}
