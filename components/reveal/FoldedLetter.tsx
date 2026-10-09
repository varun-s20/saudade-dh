"use client";

/**
 * The letter inside the envelope: a sheet the exact size of the envelope face, folded in thirds.
 * It rises out of the pocket folded, then opens (top third, then bottom third) while it grows to
 * the page, and is replaced by the real face on the frame it lands (same paper, same creases).
 *
 * Each third is ONE element on rotateX with its own perspective; its inside ("front look") and
 * outside ("back look") swap opacity at 90°, when it is edge-on. No preserve-3d, so Safari never
 * has to depth-sort, and paint order (middle, bottom, top) gives the correct overlap.
 */
import { motion, motionValue, useTransform, type MotionValue } from "motion/react";
import type { ReactNode } from "react";
import { FACE_PAPER } from "@/components/envelope/EnvelopeFace";

export interface LetterMotion {
  /** Translate/scale of the whole sheet; (0, 0, 1) = exactly on the face. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  /** Top third: -180 folded down over the middle, 0 flat. */
  top: MotionValue<number>;
  /** Bottom third: 180 folded up behind the top third, 0 flat. */
  bottom: MotionValue<number>;
  /** Full-sheet shadow while it opens (the folded packet has its own). */
  plate: MotionValue<number>;
  /** 1 while the letter is the thing on screen; 0 once the face has taken over. */
  visible: MotionValue<number>;
}

interface FoldedLetterProps {
  mv: LetterMotion;
  /** Sheet size and position (px) in the containing block: the face rect. */
  left: number;
  top: number;
  width: number;
  height: number;
}

const PERSPECTIVE = 2200;
/** Static angle for the middle third (it never moves); keeps the hooks unconditional. */
const ZERO = motionValue(0);

function Panel({
  index,
  angle,
  width,
  height,
  outside,
}: {
  index: 0 | 1 | 2;
  angle: MotionValue<number> | null;
  width: number;
  height: number;
  outside?: ReactNode;
}) {
  const h = height / 3;
  const still = angle === null;
  const front = useTransform(angle ?? ZERO, (a) => (Math.abs(a) <= 90 ? 1 : 0));
  const back = useTransform(angle ?? ZERO, (a) => (Math.abs(a) <= 90 ? 0 : 1));
  const shade = useTransform(angle ?? ZERO, (a) => {
    const t = Math.abs(a);
    return t <= 90 ? (t / 90) * 0.13 : 0.13 - ((t - 90) / 90) * 0.1;
  });
  const paperAt = { ...FACE_PAPER, backgroundPosition: `0 ${-index * h}px, 0 ${-index * h}px` };

  return (
    <motion.div
      className="absolute left-0"
      style={{
        top: index * h,
        width,
        height: h,
        ...(still ? {} : { rotateX: angle, transformPerspective: PERSPECTIVE, originX: 0.5, originY: index === 0 ? 1 : 0 }),
      }}
    >
      <motion.div className="absolute inset-0" style={{ ...paperAt, opacity: still ? 1 : front }}>
        {/* Crease halves on the fold edges, matching FoldCreases on the face. */}
        {index > 0 ? (
          <div className="absolute inset-x-0 top-0 h-[1.5px]" style={{ background: "linear-gradient(to bottom, var(--crease-light), transparent)" }} />
        ) : null}
        {index < 2 ? (
          <div className="absolute inset-x-0 bottom-0 h-[1.5px]" style={{ background: "linear-gradient(to bottom, transparent, var(--crease-dark))" }} />
        ) : null}
      </motion.div>
      {still ? null : (
        <motion.div className="absolute inset-0" style={{ ...FACE_PAPER, opacity: back }}>
          {/* Seen from behind the panel is mirrored; pre-flip so writing reads upright. */}
          <div className="absolute inset-0 flex -scale-y-100 items-center justify-center">{outside}</div>
        </motion.div>
      )}
      {still ? null : <motion.div className="absolute inset-0" style={{ background: "var(--shade)", opacity: shade }} />}
    </motion.div>
  );
}

/** A small heart drawn in fountain-pen ink on the outside of the folded letter. */
function HeartDoodle({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 40 36" fill="none" aria-hidden>
      <path
        d="M20.4 32.6C14 27.9 4.6 21.4 4.1 13.2 3.7 7.6 7.6 4 12 4.3c3.6.2 6.4 2.8 8.1 6.3 1.7-3.8 4.6-6.6 8.5-6.6 4.6 0 7.9 3.8 7.3 9.2-.9 7.9-9.8 14.2-15.3 19.4"
        stroke="var(--ink-letter)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FoldedLetter({ mv, left, top, width, height }: FoldedLetterProps) {
  const packetShadow = useTransform(mv.plate, (p) => 1 - p);
  const h = height / 3;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left, top, width, height, x: mv.x, y: mv.y, scale: mv.scale, opacity: mv.visible, originX: 0.5, originY: 0.5 }}
    >
      {/* Shadows: the folded packet's, handing over to the open sheet's. Opacity only. */}
      <motion.div className="absolute inset-0 rounded-paper shadow-paper" style={{ opacity: mv.plate }} />
      <motion.div className="absolute inset-x-0 shadow-lifted" style={{ top: h, height: h, opacity: packetShadow }} />

      <Panel index={1} angle={null} width={width} height={height} />
      <Panel index={2} angle={mv.bottom} width={width} height={height} />
      <Panel
        index={0}
        angle={mv.top}
        width={width}
        height={height}
        outside={<HeartDoodle size={Math.max(30, width * 0.1)} />}
      />
    </motion.div>
  );
}
