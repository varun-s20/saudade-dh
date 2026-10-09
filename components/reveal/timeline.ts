/**
 * The first-tap reveal as data: one Motion sequence per mode, plus the sound cues that ride on
 * it. Pure (no React, no DOM), so the timing in docs/MOTION_SPEC.md §3 maps 1:1 to this file.
 *
 * All times are seconds; intro times are from mount, opening times from the recipient's tap.
 */
import type { AnimationSequence, MotionValue } from "motion/react";
import type { StampKind } from "@/lib/services/types";
import { ease, reveal, revealReduced, spring } from "@/lib/tokens";
import type { EnvelopeMotion } from "@/components/envelope/Envelope";
import type { StampMotion } from "@/components/envelope/StampButton";
import type { SoundCue } from "./sound";
import type { LetterMotion } from "./FoldedLetter";

export interface RevealValues {
  desk: MotionValue<number>;
  /** The envelope's arrival (wrapper around <Envelope>). */
  envEnterY: MotionValue<number>;
  envOpacity: MotionValue<number>;
  env: EnvelopeMotion;
  prompt: MotionValue<number>;
  promptY: MotionValue<number>;
  chrome: MotionValue<number>;
  letter: LetterMotion;
  face: MotionValue<number>;
  decor: MotionValue<number>;
  hint: MotionValue<number>;
  stamps: Record<StampKind, StampMotion>;
}

/** Stage-relative layout the ceremony is computed from (px). */
export interface RevealGeometry {
  stageW: number;
  stageH: number;
  env: { x: number; y: number; w: number; h: number };
  face: { x: number; y: number; w: number; h: number };
}

export interface LetterPath {
  /** Folded, resting inside the envelope. */
  inside: { x: number; y: number; scale: number };
  /** Folded, drawn fully out above the envelope. */
  risen: { x: number; y: number; scale: number };
}

/** Where the folded letter sits inside the envelope and where it is drawn out to. */
export function letterPath(g: RevealGeometry): LetterPath {
  const { env, face } = g;
  // The packet is the middle third of the sheet; fit it inside the pocket.
  const scale = Math.min((0.86 * env.w) / face.w, (0.8 * env.h) / (face.h / 3));
  const packetH = (scale * face.h) / 3;
  const faceCx = face.x + face.w / 2;
  const faceCy = face.y + face.h / 2;
  const insideCx = env.x + env.w / 2;
  const insideCy = env.y + 0.09 * env.h + packetH / 2;
  const rise = 0.09 * env.h + packetH + 0.05 * env.h; // bottom edge clears the envelope's mouth
  return {
    inside: { x: insideCx - faceCx, y: insideCy - faceCy, scale },
    risen: { x: insideCx - faceCx, y: insideCy - faceCy - rise, scale },
  };
}

/** The envelope's resting rect for a stage (phone-first; larger but capped on wide screens). */
export function envelopeRect(stageW: number, stageH: number, aspect: number) {
  const wide = stageW >= 1024;
  const w = Math.min(stageW * 0.86, wide ? 560 : 440, stageH * (wide ? 0.4 : 0.34) * aspect);
  const h = w / aspect;
  return { x: (stageW - w) / 2, y: stageH * 0.45 - h / 2, w, h };
}

export function introSequence(v: RevealValues, g: RevealGeometry, reduced: boolean): AnimationSequence {
  if (reduced) {
    return [
      [v.desk, [0, 1], { at: 0, duration: 0.6, ease: ease.out }],
      [v.envOpacity, [0, 1], { at: 0.2, duration: 0.5, ease: ease.out }],
      [v.prompt, [0, 1], { at: 0.8, duration: 0.5, ease: ease.out }],
      [v.chrome, [0, 1], { at: 0.8, duration: 0.4, ease: ease.out }],
    ];
  }
  return [
    [v.desk, [0, 1], { at: reveal.paperFadeIn, duration: 0.7, ease: ease.out }],
    [v.envOpacity, [0, 1], { at: reveal.envelopeEnter, duration: 0.35, ease: ease.out }],
    [v.envEnterY, [Math.round(g.stageH * 0.16), 0], { at: reveal.envelopeEnter, ...spring.envelope }],
    [v.prompt, [0, 1], { at: reveal.promptAppear, duration: 0.55, ease: ease.out }],
    [v.promptY, [8, 0], { at: reveal.promptAppear, duration: 0.55, ease: ease.out }],
    [v.chrome, [0, 1], { at: reveal.promptAppear, duration: 0.4, ease: ease.out }],
  ];
}

/** The seal's halo: three slow breaths, then a steady soft glow (starts once the envelope lands). */
export const GLOW_BREATHS = { keyframes: [0, 1, 0.45, 1, 0.45, 1, 0.75], duration: 7.2, delay: 0.95 } as const;

export interface OpeningPlan {
  sequence: AnimationSequence;
  cues: { cue: SoundCue; at: number }[];
  /** When the last value comes to rest (s after the tap). */
  duration: number;
}

const DESCEND = [0.36, 0, 0.58, 1] as const;

export function openingSequence(
  v: RevealValues,
  g: RevealGeometry,
  kinds: readonly StampKind[],
  jitter: readonly number[],
  reduced: boolean,
): OpeningPlan {
  const seq: AnimationSequence = [];
  const cues: OpeningPlan["cues"] = [];

  if (reduced) {
    const R = revealReduced;
    seq.push([v.prompt, [1, 0], { at: 0, duration: 0.3, ease: ease.out }]);
    seq.push([v.chrome, [1, 0], { at: 0, duration: 0.3, ease: ease.out }]);
    seq.push([v.envOpacity, [1, 0], { at: R.envelopeOut, duration: 0.45, ease: ease.out }]);
    seq.push([v.face, [0, 1], { at: R.faceIn, duration: 0.5, ease: ease.out }]);
    seq.push([v.decor, [0, 1], { at: R.faceIn, duration: 0.5, ease: ease.out }]);
    cues.push({ cue: "rustle", at: 0.02 });
    let end = R.faceIn + 0.5;
    kinds.forEach((k, i) => {
      const t = R.stampsStart + i * R.stampStagger;
      const s = v.stamps[k];
      seq.push([s.opacity, [0, 1], { at: t, duration: R.stampFade, ease: ease.out }]);
      seq.push([s.mark, [0, 1], { at: t + 0.12, duration: R.stampFade, ease: ease.out }]);
      cues.push({ cue: "thud", at: t + 0.05 });
      end = t + 0.12 + R.stampFade;
    });
    seq.push([v.hint, [0, 1], { at: end + R.hintAfterLast, duration: 0.4, ease: ease.out }]);
    return { sequence: seq, cues, duration: end + R.hintAfterLast + 0.4 };
  }

  const T = reveal;
  const path = letterPath(g);
  const L = v.letter;

  // The threshold quietly steps back.
  seq.push([v.prompt, [1, 0], { at: 0, duration: 0.25, ease: ease.out }]);
  seq.push([v.env.glow, [v.env.glow.get(), 0], { at: 0, duration: 0.3, ease: ease.out }]);

  // Seal lifts (crack + rise), the flap swings open toward the viewer and lies back.
  seq.push([v.env.seal, [0, 1], { at: T.sealLift, duration: 0.5, ease: ease.out }]);
  seq.push([v.env.flap, [0, 180], { at: T.flapOpen, duration: 0.85, ease: ease.hinge }]);
  cues.push({ cue: "crack", at: 0.02 }, { cue: "rustle", at: T.flapOpen + 0.06 });

  // The folded letter is drawn up out of the pocket.
  seq.push([L.y, [path.inside.y, path.risen.y], { at: T.letterRise, duration: T.letterRiseFor, ease: ease.lift }]);
  cues.push({ cue: "slide", at: T.letterRise });

  // The emptied envelope sinks away while the letter comes toward you and opens.
  seq.push([v.env.bodyY, [0, Math.round(g.env.h * 0.42)], { at: T.envelopeAway, duration: 0.6, ease: ease.fall }]);
  seq.push([v.env.bodyOpacity, [1, 0], { at: T.envelopeAway + 0.06, duration: 0.5, ease: ease.inOut }]);
  const expand = T.letterExpandFor;
  seq.push([L.x, [path.risen.x, 0], { at: T.letterExpand, duration: expand, ease: ease.bring }]);
  seq.push([L.y, [path.risen.y, 0], { at: T.letterExpand, duration: expand, ease: ease.bring }]);
  seq.push([L.scale, [path.risen.scale, 1], { at: T.letterExpand, duration: expand, ease: ease.bring }]);
  seq.push([L.top, [-180, 0], { at: T.unfoldTop, duration: 0.62, ease: ease.hinge }]);
  seq.push([L.bottom, [180, 0], { at: T.unfoldBottom, duration: 0.62, ease: ease.hinge }]);
  // The open sheet's shadow only once the bottom third is down (else it would outline paper
  // that isn't there yet); the folded packet's own shadow hands over to it.
  seq.push([L.plate, [0, 1], { at: T.unfoldBottom + 0.32, duration: T.faceSwap - T.unfoldBottom - 0.32, ease: ease.inOut }]);
  cues.push({ cue: "unfold", at: T.unfoldTop + 0.08 }, { cue: "unfold", at: T.unfoldBottom + 0.08 });

  // Same paper, same frame: the face takes over and its handwriting inks in.
  seq.push([v.face, [0, 1], { at: T.faceSwap, duration: 0.001 }]);
  seq.push([L.visible, [1, 0], { at: T.faceSwap, duration: 0.001 }]);
  seq.push([v.decor, [0, 1], { at: T.faceSwap + 0.02, duration: 0.5, ease: ease.out }]);

  // Stamps, one by one: descend with a slight turn, land with a soft press, then the postmark.
  let lastMark = T.faceSwap + 0.5;
  kinds.forEach((k, i) => {
    const t = T.stampsStart + i * T.stampStagger;
    const s = v.stamps[k];
    const land = t + T.stampDrop;
    seq.push([s.opacity, [0, 1], { at: t, duration: 0.14, ease: ease.out }]);
    seq.push([s.y, [-30, 0], { at: t, duration: T.stampDrop, ease: DESCEND }]);
    seq.push([
      s.scale,
      [1.17, 0.982, 1],
      { at: t, duration: T.stampDrop + 0.16, times: [0, T.stampDrop / (T.stampDrop + 0.16), 1], ease: [DESCEND, ease.out] },
    ]);
    seq.push([s.rotate, [jitter[i] ?? 0, 0], { at: t, duration: T.stampDrop + 0.08, ease: ease.out }]);
    seq.push([s.cast, [0, 0.55, 0], { at: t, duration: T.stampDrop, times: [0, 0.35, 1], ease: "easeInOut" }]);
    const tm = land + T.postmarkAfterLand;
    seq.push([s.mark, [0, 1], { at: tm, duration: 0.07, ease: ease.ink }]);
    seq.push([s.markScale, [1.22, 1], { at: tm, duration: T.postmarkInk, ease: ease.ink }]);
    cues.push({ cue: "thud", at: land - 0.02 }, { cue: "ink", at: tm });
    lastMark = tm + T.postmarkInk;
  });

  const hintAt = lastMark + T.hintAfterLast;
  seq.push([v.hint, [0, 1], { at: hintAt, duration: 0.5, ease: ease.out }]);
  seq.push([v.chrome, [1, 0], { at: hintAt, duration: 0.4, ease: ease.out }]);
  return { sequence: seq, cues, duration: hintAt + 0.5 };
}

/** Values every stamp starts from when its drop begins (full motion) or fades in (reduced). */
export function primeStamps(v: RevealValues, kinds: readonly StampKind[], jitter: readonly number[], reduced: boolean) {
  kinds.forEach((k, i) => {
    const s = v.stamps[k];
    s.opacity.set(0);
    s.y.set(reduced ? 0 : -30);
    s.scale.set(reduced ? 1 : 1.17);
    s.rotate.set(reduced ? 0 : (jitter[i] ?? 0));
    s.cast.set(0);
    s.mark.set(0);
    s.markScale.set(1);
  });
}
