/**
 * JS mirror of the motion and layering tokens in styles/tokens.css, for Motion (Framer Motion)
 * choreography. Keep the two files in sync; MOTION_SPEC.md documents the intent of each value.
 */

/** Durations in seconds (Motion uses seconds). */
export const duration = {
  instant: 0.1,
  fast: 0.18,
  base: 0.28,
  slow: 0.48,
  ceremony: 0.9,
} as const;

/** Cubic-bezier easings, same curves as the --motion-ease-* CSS tokens. */
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  paper: [0.3, 0.7, 0.2, 1],
  press: [0.55, 0, 0.75, 0.2],
  /** Drawn out of the envelope: a gentle pull that eases to a stop. */
  lift: [0.33, 0, 0.15, 1],
  /** Falling away, accelerating (the empty envelope leaving the stage). */
  fall: [0.5, 0, 0.75, 0],
  /** Paper hinges: the flap and the letter folds. */
  hinge: [0.45, 0, 0.2, 1],
  /** Brought toward you: soft start, long gentle settle (the letter growing to the page). */
  bring: [0.45, 0, 0.15, 1],
  /** Ink hitting paper: very fast attack, soft tail (postmarks). */
  ink: [0.2, 0.9, 0.3, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Spring presets. "settle" = gentle overshoot for objects landing on paper. */
export const spring = {
  settle: { type: "spring", stiffness: 260, damping: 22, mass: 0.9 },
  soft: { type: "spring", stiffness: 170, damping: 26 },
  press: { type: "spring", stiffness: 520, damping: 30 },
  sheet: { type: "spring", stiffness: 380, damping: 38 },
  /** The closed envelope arriving: one soft overshoot (~4%), no wobble. */
  envelope: { type: "spring", stiffness: 140, damping: 17, mass: 1 },
  /** A stamp world growing out of its stamp. Critically damped, no bounce. */
  morph: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
  /** Turntable tonearm swinging on its pivot. */
  arm: { type: "spring", stiffness: 90, damping: 18, mass: 1 },
} as const;

/**
 * First-tap reveal timeline (seconds). Source: MASTER_BUILD_PROMPT §6.4, refined and documented
 * in docs/MOTION_SPEC.md §3 (the table there is the source of truth for intent).
 * Intro beats are from mount; the rest are offsets after the recipient's "Tap to open".
 */
export const reveal = {
  paperFadeIn: 0,
  envelopeEnter: 0.4,
  promptAppear: 1.2,
  skippableAfter: 1.5,
  /** Offsets after the recipient taps "Tap to open". */
  sealLift: 0,
  flapOpen: 0.2,
  letterRise: 0.82,
  stampsStart: 2.5,
  stampStagger: 0.35,
  /** How long the letter takes to be drawn out of the pocket. */
  letterRiseFor: 0.62,
  /** The emptied envelope sinks and fades. */
  envelopeAway: 1.42,
  /** The folded letter travels to centre and grows to the page (starts as the rise ends). */
  letterExpand: 1.44,
  letterExpandFor: 0.92,
  /** Tri-fold letter: top third opens, then the bottom third. */
  unfoldTop: 1.48,
  unfoldBottom: 1.7,
  /** The unfolded letter becomes the interactive face (decorations ink in). */
  faceSwap: 2.36,
  /** One stamp: descend + press, then its postmark lands. */
  stampDrop: 0.4,
  postmarkAfterLand: 0.04,
  postmarkInk: 0.14,
  /** "Tap a stamp to open it." after the last postmark. */
  hintAfterLast: 0.25,
} as const;

/** Reduced-motion reveal: a crossfade sequence (opacity only), seconds after the tap. */
export const revealReduced = {
  envelopeOut: 0,
  faceIn: 0.2,
  stampsStart: 0.7,
  stampStagger: 0.2,
  stampFade: 0.35,
  hintAfterLast: 0.15,
} as const;

/** Calm entrance for repeat visits (EnvelopeView). Whole thing settles in < 600 ms. */
export const calm = {
  face: 0.42,
  stampsStart: 0.1,
  stampStagger: 0.05,
  stampFade: 0.32,
  newMarkAt: 0.36,
  hintAt: 0.3,
} as const;

export const zIndex = {
  base: 0,
  envelope: 10,
  stamps: 20,
  header: 30,
  sheet: 50,
  modal: 60,
  toast: 70,
  demo: 90,
} as const;
