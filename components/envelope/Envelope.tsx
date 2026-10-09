"use client";

/**
 * <Envelope>: the layered paper envelope (back, liner, flap on a 3D hinge, front pocket, wax seal).
 *
 * Two ways to drive it:
 * 1. Declarative `state` ("closed" | "opening" | "open" | "sealing"): the envelope animates itself
 *    and calls `onStateSettled`. Used by the empty state, the sender's Seal & send, the playground.
 * 2. `drive` (motion values): the caller owns every value and choreographs it on its own timeline
 *    (the first-tap reveal does this so the whole ceremony is one skippable sequence).
 *
 * `contents` render between the liner and the front pocket, so a letter can sit inside and be
 * drawn out. The envelope body (every layer except `contents`) can sink and fade via
 * `drive.bodyY` / `drive.bodyOpacity` while the contents stay put.
 *
 * Sizing: give it a width (className/style); height follows ENVELOPE_ASPECT.
 * Reduced motion: no 3D, no overshoot; state changes become short crossfades.
 */
import { animate, motion, useMotionValue, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { duration, ease } from "@/lib/tokens";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { EnvelopeBack, EnvelopeFlap, EnvelopeLiner, EnvelopePocket, EnvelopeSeal, ENVELOPE_ASPECT, SEAL_SIZE } from "./EnvelopeParts";
import { useElementSize } from "./useElementSize";

export { ENVELOPE_ASPECT, FLAP_DEPTH, SEAL_CENTER_Y, SEAL_SIZE } from "./EnvelopeParts";

export type EnvelopeState = "closed" | "opening" | "open" | "sealing";

/** Motion values that fully describe the envelope's pose (for external choreography). */
export interface EnvelopeMotion {
  /** Flap hinge angle, degrees: 0 closed, 180 open (lying above the envelope, liner showing). */
  flap: MotionValue<number>;
  /** Seal: 0 seated, 1 lifted away. */
  seal: MotionValue<number>;
  /** Halo around the seal, 0..1 (the "tap here" glow that mirrors the ceramic's heart). */
  glow: MotionValue<number>;
  /** Body offset (px) and opacity: lets the emptied envelope fall away. Contents unaffected. */
  bodyY: MotionValue<number>;
  bodyOpacity: MotionValue<number>;
}

export interface EnvelopeProps {
  /** Declarative pose. Ignored when `drive` is given. Default "closed". */
  state?: EnvelopeState;
  /** External motion values (the reveal). When set, the envelope never animates on its own. */
  drive?: EnvelopeMotion;
  /** Handwritten on the back ("for Theo"). */
  toName?: string | null;
  /** Breathing halo on the seal while closed (3 slow breaths, then a steady soft glow). */
  glow?: boolean;
  /** Rendered between the liner and the front pocket (e.g. a folded letter). */
  contents?: ReactNode;
  /** Fired when a declarative state change has finished animating. */
  onStateSettled?: (state: EnvelopeState) => void;
  className?: string;
  style?: CSSProperties;
}

/** Create the motion values for a driven envelope (closed pose). */
export function useEnvelopeMotion(): EnvelopeMotion {
  return {
    flap: useMotionValue(0),
    seal: useMotionValue(0),
    glow: useMotionValue(0),
    bodyY: useMotionValue(0),
    bodyOpacity: useMotionValue(1),
  };
}

export function Envelope({ state = "closed", drive, toName, glow = false, contents, onStateSettled, className, style }: EnvelopeProps) {
  const reduced = useReducedMotionPref();
  const own = useEnvelopeMotion();
  const mv = drive ?? own;
  const rootRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(rootRef);
  const settledRef = useRef(onStateSettled);
  useEffect(() => {
    settledRef.current = onStateSettled;
  });

  // Declarative state machine (only when not externally driven). "closed"/"open" are poses
  // (set instantly); "opening"/"sealing" are transitions that end in a pose.
  useEffect(() => {
    if (drive) return;
    const { flap, seal } = own;
    const runs: AnimationPlaybackControls[] = [];
    const done = () => settledRef.current?.(state === "opening" ? "open" : state === "sealing" ? "closed" : state);

    if (state === "closed" || state === "open") {
      flap.set(state === "open" ? 180 : 0);
      seal.set(state === "open" ? 1 : 0);
      return;
    }

    if (reduced) {
      // Crossfade: the seal fades, the flap swaps pose without travelling through 3D.
      if (state === "opening") {
        runs.push(animate(seal, 1, { duration: duration.base, ease: ease.out }));
        flap.set(180);
      } else {
        flap.set(0);
        runs.push(animate(seal, 0, { duration: duration.base, ease: ease.out }));
      }
      Promise.all(runs.map((r) => r.finished)).then(done, () => undefined);
      return () => runs.forEach((r) => r.stop());
    }

    if (state === "opening") {
      runs.push(animate(seal, [0, 1], { duration: 0.5, ease: ease.out }));
      runs.push(animate(flap, [0, 180], { duration: 0.85, delay: 0.2, ease: ease.hinge }));
    } else {
      // Sealing: the flap folds down, then the seal presses into place.
      runs.push(animate(flap, [flap.get(), 0], { duration: 0.75, ease: ease.hinge }));
      runs.push(animate(seal, [1, 0], { duration: 0.45, delay: 0.7, ease: ease.press }));
    }
    Promise.all(runs.map((r) => r.finished)).then(done, () => undefined);
    return () => runs.forEach((r) => r.stop());
  }, [state, drive, own, reduced]);

  // Seal halo: three slow breaths while closed, then a steady soft glow. Static when reduced.
  useEffect(() => {
    if (drive) return;
    const g = own.glow;
    if (!glow || state !== "closed") {
      const c = animate(g, 0, { duration: duration.base });
      return () => c.stop();
    }
    if (reduced) {
      g.set(0.7);
      return;
    }
    const c = animate(g, [0, 1, 0.45, 1, 0.45, 1, 0.7], { duration: 7.2, ease: "easeInOut" });
    return () => c.stop();
  }, [glow, state, drive, own, reduced]);

  const sealSize = Math.round(width * SEAL_SIZE);

  return (
    <div
      ref={rootRef}
      className={cn("relative isolate select-none", className)}
      style={{ aspectRatio: `${ENVELOPE_ASPECT}`, ...style }}
      data-envelope-state={drive ? "driven" : state}
    >
      {/* Body: every paper layer. No z-index of its own and no transform at rest, so the
          contents below can sit between the liner and the pocket. */}
      <motion.div aria-hidden className="absolute inset-0" style={{ y: mv.bodyY, opacity: mv.bodyOpacity }}>
        <EnvelopeBack />
        <EnvelopeFlap angle={mv.flap} flat={reduced && !drive} />
        <EnvelopeLiner />
        <EnvelopePocket toName={toName} />
        <EnvelopeSeal lift={mv.seal} glow={mv.glow} size={sealSize} reduced={reduced} pressed={state === "sealing"} />
      </motion.div>
      {contents ? (
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {contents}
        </div>
      ) : null}
    </div>
  );
}
