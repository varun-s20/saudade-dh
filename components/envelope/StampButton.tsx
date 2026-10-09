"use client";

/**
 * A stamp on the recipient's envelope face: a real <button> wrapping the client's stamp artwork,
 * its cancellation (an undated ring with the stamp's own wording and a heart; the one dated
 * cancellation sits by the address on the face) and, optionally, a small NEW mark.
 *
 * Three entrances:
 *   "none"    already there (hand-off from the reveal, or no animation wanted)
 *   "calm"    repeat visit: a soft fade + settle, staggered, all done well under 600 ms
 *   "driven"  first-tap reveal: every value is a motion value owned by the reveal's timeline
 *
 * Micro-interactions (MOTION_SPEC §8): hover (fine pointers only) lifts 2px and brings up a soft
 * lifted shadow; press sinks to 0.97 on a stiff spring. Both are reduced to nothing / opacity
 * under reduced motion.
 */
import { motion, motionValue, type MotionValue } from "motion/react";
import type { MouseEvent } from "react";
import { STAMPS } from "@/config/stamps";
import type { StampKind } from "@/lib/services/types";
import { Stamp, stampHeight } from "@/components/stamps/Stamp";
import { Postmark } from "@/components/paper/Postmark";
import { calm, ease, spring } from "@/lib/tokens";
import type { FaceSlot } from "./EnvelopeFace";

/** Motion values for one stamp during the reveal. */
export interface StampMotion {
  opacity: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  rotate: MotionValue<number>;
  /** Soft cast shadow while the stamp is in the air. */
  cast: MotionValue<number>;
  /** Postmark ink: opacity and the "hit" scale. */
  mark: MotionValue<number>;
  markScale: MotionValue<number>;
}

export function createStampMotion(): StampMotion {
  return {
    opacity: motionValue(0),
    y: motionValue(0),
    scale: motionValue(1),
    rotate: motionValue(0),
    cast: motionValue(0),
    mark: motionValue(0),
    markScale: motionValue(1),
  };
}

/**
 * Where each stamp's cancellation lands: the ring's centre as % of the stamp box. Marks lean
 * toward the middle of the face, like a clerk working round the pile; wavy "killer" lines run
 * back across the stamp.
 */
const MARK_PLACE: Record<StampKind, { x: number; y: number; rotate: number; variant: "circle" | "wavy"; side: "left" | "right" }> = {
  photos: { x: 82, y: 76, rotate: -6, variant: "wavy", side: "left" },
  letter: { x: 20, y: 80, rotate: 9, variant: "circle", side: "right" },
  voice: { x: 82, y: 22, rotate: 11, variant: "circle", side: "left" },
  song: { x: 18, y: 24, rotate: -5, variant: "wavy", side: "right" },
};

/** NEW marks go in the corner opposite each stamp's cancellation so the two never pile up. */
const NEW_PLACE: Record<StampKind, { x: number; y: number; rotate: number }> = {
  photos: { x: 8, y: 8, rotate: -12 },
  letter: { x: 92, y: 8, rotate: 10 },
  voice: { x: 10, y: 90, rotate: 8 },
  song: { x: 90, y: 90, rotate: -10 },
};

export type StampEntrance = "none" | "calm" | "driven";

export interface StampButtonProps {
  slot: FaceSlot;
  label: string;
  isNew?: boolean;
  entrance: StampEntrance;
  mv?: StampMotion;
  reduced: boolean;
  onOpen?: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
}

export function StampButton({ slot, label, isNew, entrance, mv, reduced, onOpen }: StampButtonProps) {
  const { kind, width, rotate, index } = slot;
  const def = STAMPS[kind];
  const mark = MARK_PLACE[kind];
  const markSize = Math.round(width * 0.56);
  const height = stampHeight(kind, width);
  const wavy = mark.variant === "wavy";
  // The ring sits at one end of a wavy mark (2 × size wide); place the ring, not the box.
  const markW = wavy ? markSize * 2 : markSize;
  const ringOffset = wavy ? (mark.side === "left" ? 1.5 : 0.5) * markSize : markSize / 2;
  const newSize = Math.round(Math.max(40, width * 0.36));

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    // Safari does not focus buttons on click; focus it so a sheet can return focus here.
    el.focus({ preventScroll: true });
    onOpen?.(kind, el.getBoundingClientRect(), el);
  };

  const calmDelay = calm.stampsStart + index * calm.stampStagger;
  const driven = entrance === "driven" && mv;

  // The artwork and postmarks sit BESIDE the button, not inside it: their printed words
  // ("SNAPSHOTS", dates) are decoration, and text inside a control must be part of its accessible
  // name (WCAG 2.5.3 Label in Name). The button is a transparent hit area over the stamp; the
  // wrapper carries the hover/press motion so the artwork still lifts and sinks with it.
  return (
    <motion.div
      className="group relative block rounded-soft [-webkit-touch-callout:none]"
      style={{ width, height }}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? { opacity: 0.85 } : { scale: 0.97 }}
      transition={spring.press}
    >
      {/* The stamp itself (plus its in-flight cast shadow when driven). */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 block"
        style={driven ? { opacity: mv.opacity, y: mv.y, scale: mv.scale, rotate: mv.rotate } : undefined}
        initial={entrance === "calm" ? { opacity: 0, scale: reduced ? 1 : 0.985 } : false}
        animate={entrance === "calm" ? { opacity: 1, scale: 1 } : undefined}
        transition={{ delay: calmDelay, duration: calm.stampFade, ease: ease.out }}
      >
        {driven ? (
          <motion.span
            aria-hidden
            className="absolute inset-[6%] block rounded-soft blur-[7px]"
            style={{ background: "var(--cast-shadow)", opacity: mv.cast, y: 10, scale: 1.04 }}
          />
        ) : null}
        {/* Lifted shadow on hover/focus: a static shadow whose opacity changes (never box-shadow). */}
        <span
          aria-hidden
          className="absolute inset-[5%] block rounded-soft opacity-0 shadow-lifted transition-opacity duration-200 ease-out-soft group-hover:opacity-100 group-has-focus-visible:opacity-100"
        />
        <span className="relative block">
          <Stamp kind={kind} width={width} rotate={rotate} />
        </span>
      </motion.span>

      {/* Cancellation: inked over the stamp and the paper around it. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute block"
        style={{
          left: (mark.x / 100) * width - ringOffset,
          top: (mark.y / 100) * height - markSize / 2,
          width: markW,
          height: markSize,
          ...(driven ? { opacity: mv.mark, scale: mv.markScale } : {}),
        }}
        initial={entrance === "calm" ? { opacity: 0 } : false}
        animate={entrance === "calm" ? { opacity: 1 } : undefined}
        transition={{ delay: calmDelay + 0.06, duration: calm.stampFade, ease: ease.out }}
      >
        <Postmark
          variant={mark.variant}
          wavySide={mark.side}
          place={def.postmark}
          bottom="SAUDADE"
          size={markSize}
          rotate={mark.rotate}
          opacity={0.82}
        />
      </motion.span>

      {isNew ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute block"
          style={{
            left: (NEW_PLACE[kind].x / 100) * width - newSize / 2,
            top: (NEW_PLACE[kind].y / 100) * height - newSize / 2,
            width: newSize,
            height: newSize,
          }}
          initial={entrance === "none" ? false : { opacity: 0, scale: reduced ? 1 : 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: entrance === "calm" ? calm.newMarkAt : 0.1, duration: 0.18, ease: ease.ink }}
        >
          <Postmark variant="new" place="SAUDADE" size={newSize} rotate={NEW_PLACE[kind].rotate} ink="red" />
        </motion.span>
      ) : null}

      <button
        type="button"
        aria-label={isNew ? `${label} (new)` : label}
        onClick={handleClick}
        className="absolute inset-0 block rounded-soft"
        data-stamp-button={kind}
      />
    </motion.div>
  );
}
