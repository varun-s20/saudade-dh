"use client";

/**
 * <EnvelopeFace>: the address side the stamps live on. On the recipient page it is the unfolded
 * letter that came out of the envelope (it keeps its two fold creases); in the sender portal it
 * is the envelope being filled. Stamp positions come from config/stamps.ts `place`, so sender and
 * recipient share the same spatial memory.
 *
 * It renders no stamps itself: `renderSlot(kind, slot)` returns whatever belongs in each slot
 * (recipient: a stamp button; sender: an empty/filled slot link). `slot.width` is the stamp width
 * in px for the current face size.
 */
import { motion, type MotionValue } from "motion/react";
import { useRef, type ReactNode, type Ref } from "react";
import { STAMPS } from "@/config/stamps";
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { stampHeight } from "@/components/stamps/Stamp";
import { Postmark } from "@/components/paper/Postmark";
import { cn } from "@/lib/utils/cn";
import { useElementSize } from "./useElementSize";

export interface FaceSlot {
  kind: StampKind;
  /** Stamp width in px for this face size (height follows the artwork + perforation). */
  width: number;
  /** Resting rotation in degrees (STAMPS[kind].place.rotate). */
  rotate: number;
  /** Position among the rendered slots (0-based, envelope order). */
  index: number;
}

export interface EnvelopeFaceProps {
  /** Content of each stamp slot. Called for every kind in `kinds`. */
  renderSlot: (kind: StampKind, slot: FaceSlot) => ReactNode;
  /** Which slots to render, in envelope order. Default: all four. */
  kinds?: readonly StampKind[];
  /** Handwritten addressee ("for Theo"). Falls back to "you". */
  toName?: string | null;
  /** Small handwritten sender line ("from Mira"). */
  fromName?: string | null;
  /** ISO date; adds a dated cancellation near the address. */
  postmarkDate?: string | null;
  /**
   * "fill": fill the parent box (recipient, full screen). A number: width ÷ height ratio for a
   * self-sizing face (sender portal). Default 0.62.
   */
  fit?: "fill" | number;
  /** Opacity of the inked/handwritten decorations; the reveal inks them in. Default 1. */
  decorOpacity?: MotionValue<number> | number;
  /** Rendered at the foot of the face (e.g. "Tap a stamp to open it."). */
  footer?: ReactNode;
  /** Ref to the face's paper element (the reveal measures it). */
  faceRef?: Ref<HTMLDivElement>;
  /** Px kept clear between the bottom row of stamps and "for" (more when tags hang below). */
  clearance?: number;
  className?: string;
}

const clamp = (min: number, v: number, max: number) => Math.min(Math.max(v, min), max);

/** Stamps whose configured place is below this (% down the face) form the bottom row. */
const BOTTOM_ROW_Y = 40;

/**
 * Stamp size and the bottom row's lowest position for a face. The stamps are a share of the face
 * width, capped by its height; the bottom row (configured at about 50% down) must end above the
 * address block ("for", the name with its seal, the "from" line). When a short, wide face doesn't
 * have that room (a laptop screen), the bottom row rises (up to 36% down, still clear of the top
 * row) before the stamps shrink, so they stay a good size and the two rows don't leave an empty
 * band between them. `blockH` is the block's measured height (estimated from its type sizes
 * until it has been measured).
 */
export function faceLayout(faceW: number, faceH: number, footer = false, clearance = 14, blockH = 0): { stampW: number; bottomRowMaxTop: number } {
  const rem = 16;
  const ratio = stampHeight("photos", 100) / 100;
  const block = blockH || clamp(0.85 * rem, 0.041 * faceW, 1.1 * rem) + Math.max(clamp(2 * rem, 0.125 * faceW, 3.5 * rem) * 1.15, Math.max(36, faceW * 0.12) + faceW * 0.016) + clamp(1.05 * rem, 0.056 * faceW, 1.5 * rem) * 1.9;
  const blockTop = faceH * (1 - (footer ? 0.115 : 0.075)) - block;
  const byWidth = faceW * 0.35;
  const byHeight = (faceH * 0.2) / ratio;
  const byRoom = (blockTop - faceH * 0.36 - clearance) / ratio;
  const stampW = Math.round(Math.max(72, Math.min(byWidth, byHeight, byRoom, 168)));
  return { stampW, bottomRowMaxTop: blockTop - stampW * ratio - clearance };
}

/** Paper background shared by the face and the folded letter (they must match exactly). */
export const FACE_PAPER = {
  backgroundColor: "var(--paper-raised)",
  backgroundImage: "var(--texture-fibre), var(--texture-grain)",
  backgroundSize: "400px 400px, var(--texture-grain-size)",
} as const;

/** The two creases left by folding the letter in thirds. */
export function FoldCreases() {
  return (
    <>
      {[1 / 3, 2 / 3].map((f) => (
        <div
          key={f}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-[3px]"
          style={{
            top: `calc(${f * 100}% - 1.5px)`,
            background: "linear-gradient(to bottom, transparent, var(--crease-dark) 45%, var(--crease-light) 55%, transparent)",
          }}
        />
      ))}
    </>
  );
}

export function EnvelopeFace({
  renderSlot,
  kinds = STAMP_KINDS,
  toName,
  fromName,
  postmarkDate,
  fit = 0.62,
  decorOpacity = 1,
  footer,
  faceRef,
  clearance,
  className,
}: EnvelopeFaceProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(measureRef);
  const blockRef = useRef<HTMLDivElement>(null);
  const { height: blockH } = useElementSize(blockRef);
  const { stampW, bottomRowMaxTop } = width > 0 ? faceLayout(width, height, Boolean(footer), clearance, blockH) : { stampW: 0, bottomRowMaxTop: 0 };
  const name = toName?.trim() || "you";

  return (
    <div
      ref={measureRef}
      className={cn("relative", fit === "fill" ? "h-full w-full" : "w-full", className)}
      style={fit === "fill" ? undefined : { aspectRatio: `${fit}` }}
    >
      <div
        ref={faceRef}
        className="@container absolute inset-0 rounded-paper shadow-paper"
        style={FACE_PAPER}
        data-envelope-face
      >
        <FoldCreases />

        {/* Inked and handwritten details. */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: decorOpacity }}>
          {postmarkDate ? (
            <div className="absolute" style={{ right: "19%", bottom: footer ? "8.5%" : "4.5%" }}>
              <Postmark date={postmarkDate} place="SAUDADE" size={Math.round(Math.max(64, width * 0.2))} rotate={-8} opacity={0.8} />
            </div>
          ) : null}
          <div ref={blockRef} className="absolute" style={{ left: "9%", right: "9%", bottom: footer ? "11.5%" : "7.5%" }}>
            <p className="font-ui font-semibold leading-none text-ink-faded" style={{ fontSize: "clamp(0.85rem, 4.1cqw, 1.1rem)" }}>
              for
            </p>
            <div className="relative flex items-end justify-between border-b border-paper-shadow">
              <p className="truncate pr-[0.2em] pl-[6%] font-hand leading-[1.15] text-ink-letter" style={{ fontSize: "clamp(2rem, 12.5cqw, 3.5rem)" }}>
                {name}
              </p>
              <div className="mb-[2%] shrink-0 -rotate-6">
                <HeartSeal size={Math.round(Math.max(36, width * 0.12))} />
              </div>
            </div>
            <div className="flex min-h-[1.9em] items-end border-b border-paper-shadow pl-[18%]" style={{ fontSize: "clamp(1.05rem, 5.6cqw, 1.5rem)" }}>
              {fromName ? <p className="truncate pr-[0.2em] font-hand leading-tight text-ink-soft">from {fromName}</p> : null}
            </div>
          </div>
        </motion.div>

        {/* Stamp slots at their configured places. */}
        {stampW > 0
          ? kinds.map((kind, index) => {
              const place = STAMPS[kind].place;
              return (
                <div
                  key={kind}
                  className="absolute"
                  style={{ left: `${place.x}%`, top: place.y >= BOTTOM_ROW_Y ? Math.min((place.y / 100) * height, bottomRowMaxTop) : `${place.y}%`, width: stampW }}
                  data-slot={kind}
                >
                  {renderSlot(kind, { kind, width: stampW, rotate: place.rotate, index })}
                </div>
              );
            })
          : null}

        {footer ? <div className="absolute inset-x-0 bottom-[3.2%] flex justify-center px-6">{footer}</div> : null}
      </div>
    </div>
  );
}
