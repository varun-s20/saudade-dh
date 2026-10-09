"use client";

/**
 * The envelope's physical layers. Internal to components/envelope; compose them through
 * <Envelope>. Geometry is in % of the envelope box (aspect ENVELOPE_ASPECT), so it scales cleanly.
 *
 * Stacking (inside the envelope root):
 *   0 back panel · 1 flap when open · 2 liner · 3 CONTENTS (the letter) · 4 front pocket ·
 *   5 flap when closed (+ its cast shadow) · 6 wax seal
 *
 * 3D without preserve-3d: the flap is ONE element rotating on rotateX with its own perspective.
 * Its outside ("front look") and its liner side ("back look") are two layers inside it whose
 * opacity swaps at 90°, when the flap is edge-on, so the swap is invisible and Safari never has
 * to sort 3D planes. Shading is a flat --shade layer whose opacity follows the angle.
 */
import { motion, useTransform, type MotionValue } from "motion/react";
import { HeartSeal } from "@/components/stamps/HeartSeal";

/** Width / height of the envelope (C6-ish proportions). */
export const ENVELOPE_ASPECT = 1.42;
/** Flap depth as a fraction of the envelope height (tip sits a little below the middle). */
export const FLAP_DEPTH = 0.6;
/** Seal centre (fraction of envelope height) and diameter (fraction of envelope width). */
export const SEAL_CENTER_Y = 0.555;
export const SEAL_SIZE = 0.19;

const FLAP_CLIP = "polygon(0% 0%, 100% 0%, 56.5% 87%, 53% 94.5%, 50% 97%, 47% 94.5%, 43.5% 87%)";
const FLAP_LINER_CLIP = "polygon(5% 0%, 95% 0%, 54% 80%, 50% 85%, 46% 80%)";
const LEFT_CLIP = "polygon(0% 0%, 51.5% 55%, 0% 100%)";
const RIGHT_CLIP = "polygon(100% 0%, 48.5% 55%, 100% 100%)";
const BOTTOM_CLIP = "polygon(0% 100%, 2% 96.5%, 46% 51%, 50% 49%, 54% 51%, 98% 96.5%, 100% 100%)";
const BOTTOM_SHADOW_CLIP = "polygon(0% 97.5%, 2% 94%, 46% 48.5%, 50% 46.5%, 54% 48.5%, 98% 94%, 100% 97.5%)";

const TEXTURES = "var(--texture-fibre), var(--texture-grain)";
const TEXTURE_SIZES = "400px 400px, var(--texture-grain-size)";

/** Envelope paper with fibre + grain, optionally under extra gradient layers. */
function paper(color: string, ...gradients: string[]) {
  return {
    backgroundColor: color,
    backgroundImage: [...gradients, TEXTURES].join(", "),
    backgroundSize: [...gradients.map(() => "100% 100%"), TEXTURE_SIZES].join(", "),
  } as const;
}

const LINER_PATTERN = {
  backgroundColor: "var(--paper-liner)",
  backgroundImage: [
    "linear-gradient(to bottom, var(--crease-dark), transparent 40%)",
    "radial-gradient(circle, var(--liner-dot) 0.8px, transparent 1.25px)",
    "repeating-linear-gradient(45deg, transparent 0 8px, var(--liner-line) 8px 9px)",
    "repeating-linear-gradient(-45deg, transparent 0 8px, var(--liner-line) 8px 9px)",
    "var(--texture-grain)",
  ].join(", "),
  backgroundSize: "100% 100%, 12.7px 12.7px, auto, auto, var(--texture-grain-size)",
} as const;

export function EnvelopeBack() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 rounded-paper shadow-envelope"
      style={{ zIndex: 0, ...paper("var(--paper-deep)") }}
    />
  );
}

/** The patterned liner visible inside the back panel once the flap is open. */
export function EnvelopeLiner() {
  return (
    <div
      aria-hidden
      className="absolute rounded-paper"
      style={{ left: "3.2%", right: "3.2%", top: "2.6%", height: "66%", zIndex: 2, ...LINER_PATTERN }}
    />
  );
}

/** Front pocket: two side flaps + the bottom flap, with fold shading and hairline edges. */
export function EnvelopePocket({ toName, mark = true }: { toName?: string | null; mark?: boolean }) {
  return (
    <div aria-hidden className="@container absolute inset-0" style={{ zIndex: 4 }}>
      <div
        className="absolute inset-0"
        style={{ clipPath: LEFT_CLIP, ...paper("var(--paper-deep)", "linear-gradient(to right, transparent 30%, var(--crease-dark))") }}
      />
      <div
        className="absolute inset-0"
        style={{ clipPath: RIGHT_CLIP, ...paper("var(--paper-deep)", "linear-gradient(to left, transparent 30%, var(--crease-dark))") }}
      />
      {/* The bottom flap's soft shadow on the side flaps (static blur, never animated). */}
      <div className="absolute inset-0 opacity-60 blur-[1.5px]" style={{ clipPath: BOTTOM_SHADOW_CLIP, background: "var(--cast-shadow)" }} />
      <div
        className="absolute inset-0"
        style={{ clipPath: BOTTOM_CLIP, ...paper("var(--paper-deep)", "linear-gradient(to bottom, var(--crease-light), transparent 26%)") }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round">
          <path d="M0 0 L47.2 50.4 M100 0 L52.8 50.4" stroke="var(--paper-edge)" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path
            d="M0 100 L2 96.5 L46 51 L50 49 L54 51 L98 96.5 L100 100"
            stroke="var(--paper-edge)"
            strokeOpacity="0.6"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      {toName ? (
        <p
          className="absolute inset-x-0 text-center font-hand leading-none text-ink-letter"
          // low enough to clear the seal's hold ring on the seal screen
          style={{ top: "77%", fontSize: "clamp(1rem, 7.4cqw, 2.1rem)" }}
        >
          for {toName}
        </p>
      ) : null}
      {mark ? (
        <span className="postal-label absolute text-ink-faded opacity-70" style={{ right: "5%", bottom: "5.5%", fontSize: "clamp(0.5rem, 2.3cqw, 0.7rem)" }}>
          Saudade
        </span>
      ) : null}
    </div>
  );
}

/**
 * The top flap on its 3D hinge. `angle` is degrees: 0 closed over the pocket, 180 fully open
 * (lying above the envelope, liner side showing). Rotates toward the viewer, like a real flap.
 */
export function EnvelopeFlap({ angle, flat = false }: { angle: MotionValue<number>; flat?: boolean }) {
  const zIndex = useTransform(angle, (a) => (a < 90 ? 5 : 1));
  const frontLook = useTransform(angle, (a) => (a < 90 ? 1 : 0));
  const backLook = useTransform(angle, (a) => (a < 90 ? 0 : 1));
  // Light comes from above: the flap darkens as it stands up, the liner brightens as it lies back.
  const shade = useTransform(angle, [0, 90, 180], [0, 0.24, 0.04]);
  const castShadow = useTransform(angle, [0, 40], [1, 0]);

  return (
    <>
      {/* Cast shadow of the closed flap on the pocket (pre-blurred; only its opacity changes). */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 blur-[2px]"
        style={{
          height: `${FLAP_DEPTH * 100}%`,
          zIndex: 5,
          clipPath: FLAP_CLIP,
          background: "var(--cast-shadow)",
          translateY: "3%",
          opacity: castShadow,
        }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: `${FLAP_DEPTH * 100}%`,
          zIndex,
          clipPath: FLAP_CLIP,
          originX: 0.5,
          originY: 0,
          rotateX: flat ? 0 : angle,
          transformPerspective: 900,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: frontLook,
            ...paper("var(--paper-deep)", "linear-gradient(to bottom, var(--crease-light), transparent 22%, transparent 50%, var(--crease-dark))"),
          }}
        />
        <motion.div className="absolute inset-0" style={{ opacity: backLook, ...paper("var(--paper-deep)") }}>
          <div className="absolute inset-0" style={{ clipPath: FLAP_LINER_CLIP, ...LINER_PATTERN }} />
        </motion.div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 0 L43.5 87 L47 94.5 L50 97 L53 94.5 L56.5 87 L100 0"
            fill="none"
            stroke="var(--paper-edge)"
            strokeOpacity="0.7"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <motion.div className="absolute inset-0" style={{ background: "var(--shade)", opacity: shade }} />
      </motion.div>
    </>
  );
}

/**
 * The wax heart seal at the flap's tip (mirrors the NFC heart on the ceramic).
 * `lift` 0 → seated, 1 → lifted away: a small twist (the crack), then it rises, turns and fades.
 * `glow` 0..1 drives the soft halo. Reduced motion: opacity only.
 */
export function EnvelopeSeal({
  lift,
  glow,
  size,
  reduced,
  pressed,
}: {
  lift: MotionValue<number>;
  glow: MotionValue<number>;
  size: number;
  reduced: boolean;
  pressed?: boolean;
}) {
  const y = useTransform(lift, [0, 0.12, 1], [0, size * 0.015, -size * 0.5]);
  const rotate = useTransform(lift, [0, 0.12, 1], [0, 5, -16]);
  const scale = useTransform(lift, [0, 0.12, 1], [1, 0.965, 1.18]);
  const opacity = useTransform(lift, reduced ? [0, 1] : [0, 0.45, 1], reduced ? [1, 0] : [1, 1, 0]);
  const haloOpacity = useTransform(() => glow.get() * (1 - lift.get()));

  if (size <= 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2"
      style={{ zIndex: 6, top: `${SEAL_CENTER_Y * 100}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -size * 0.62,
          background: "radial-gradient(circle, var(--seal-glow) 0%, transparent 62%)",
          opacity: haloOpacity,
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={reduced ? { opacity } : { y, rotate, scale, opacity }}
      >
        <HeartSeal size={size} pressed={pressed} />
      </motion.div>
    </div>
  );
}
