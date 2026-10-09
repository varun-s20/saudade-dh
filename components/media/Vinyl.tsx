"use client";

/**
 * <Vinyl>: a vintage record on a small plinth, with a tonearm.
 *
 * - Spin is a motion value advanced every frame from a `speed` value (deg/s) that eases up to
 *   33⅓ rpm on play and coasts down on pause, the way a platter does (no CSS keyframes, so it
 *   never snaps). The light sheen is a separate, static layer: the grooves turn under the light.
 * - Tonearm: on play it swings onto the lead-in groove, then lowers (its shadow tightens);
 *   on pause it lifts first, then swings back to its rest.
 * - Drive `playing` from REAL playback (Spotify `playback_update`); never spin when nothing plays
 *   (RESEARCH §7.7). Apple Music has no events: callers use an ambient spin on play (D-013).
 * - Reduced motion: no spin; the tonearm simply sits in its playing or resting position.
 * Decorative (aria-hidden): the song world shows the title/artist as text.
 */
import { animate, motion, useAnimationFrame, useMotionValue, useTransform, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId } from "react";
import { accentInkVar, accentVar, type AccentToken } from "@/config/stamps";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { displayTrackTitle } from "@/lib/utils/format";
import { ease, spring } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";

export interface VinylProps {
  /** True only while audio is actually playing. */
  playing: boolean;
  /** Song artwork for the centre label (Spotify/Apple CDN). Falls back to a printed paper label. */
  artworkUrl?: string | null;
  title: string;
  artist?: string | null;
  /** Width of the whole object in px (record + tonearm + plinth). Height = 0.88 × size. Default 280. */
  size?: number;
  /** Colour of the printed paper label (fallback). Default "ochre" (the song stamp). */
  accent?: AccentToken;
  /** Draw the turntable plinth under the record. Default true. */
  plinth?: boolean;
  className?: string;
}

/** 33⅓ rpm in degrees per second. */
const RPM_33 = 200;
/** Tonearm angles (deg, clockwise): resting beside the record, and on the lead-in groove. */
const ARM_REST = 0;
const ARM_PLAY = 19;

// Geometry in % of `size` (the record sits left, the tonearm pivot top-right).
const REC = { cx: 0.44, cy: 0.44, d: 0.84 };
const PIVOT = { x: 0.9, y: 0.12 };

export function Vinyl({ playing, artworkUrl, title, artist, size = 280, accent = "ochre", plinth = true, className }: VinylProps) {
  const reduced = useReducedMotionPref();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const angle = useMotionValue(0);
  const speed = useMotionValue(0);
  const arm = useMotionValue(ARM_REST);
  const lift = useMotionValue(1);
  const shadowX = useTransform(lift, [0, 1], [size * 0.006, size * 0.022]);
  const shadowY = useTransform(lift, [0, 1], [size * 0.01, size * 0.034]);
  const shadowOpacity = useTransform(lift, [0, 1], [0.55, 0.32]);

  useAnimationFrame((_, delta) => {
    const s = speed.get();
    if (s < 0.05) return;
    angle.set((angle.get() + (s * Math.min(delta, 64)) / 1000) % 360);
  });

  useEffect(() => {
    if (reduced) {
      speed.set(0);
      arm.set(playing ? ARM_PLAY : ARM_REST);
      lift.set(playing ? 0 : 1);
      return;
    }
    const runs: AnimationPlaybackControls[] = [];
    if (playing) {
      runs.push(animate(speed, RPM_33, { duration: 1.3, ease: [0.3, 0, 0.25, 1] }));
      runs.push(animate(arm, ARM_PLAY, spring.arm));
      runs.push(animate(lift, 0, { delay: 0.6, duration: 0.32, ease: ease.press }));
    } else {
      runs.push(animate(lift, 1, { duration: 0.22, ease: ease.out }));
      runs.push(animate(arm, ARM_REST, { ...spring.arm, delay: 0.2 }));
      runs.push(animate(speed, 0, { duration: 1.9, ease: [0.12, 0.45, 0.3, 1] }));
    }
    return () => runs.forEach((r) => r.stop());
  }, [playing, reduced, speed, arm, lift]);

  const h = size * 0.88;
  const D = size * REC.d;
  const label = displayTrackTitle(title);

  return (
    <div aria-hidden className={cn("relative select-none", className)} style={{ width: size, height: h }} data-vinyl={playing ? "playing" : "paused"}>
      {plinth ? (
        <div
          className="paper-grain absolute rounded-card shadow-paper"
          style={{ inset: 0, background: "var(--paper-deep)", boxShadow: "inset 0 0 0 1px var(--paper-shadow), var(--elev-paper)" }}
        />
      ) : null}

      {/* Its shadow stays put (a spinning record's shadow does not orbit). */}
      <div
        className="absolute rounded-full shadow-lifted"
        style={{ left: size * REC.cx - D / 2, top: size * REC.cy - D / 2, width: D, height: D }}
      />
      {/* The record (rotates). */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: size * REC.cx - D / 2, top: size * REC.cy - D / 2, width: D, height: D, rotate: angle }}
      >
        <svg viewBox="0 0 200 200" width={D} height={D} className="block">
          <defs>
            <clipPath id={`${uid}-label`}>
              <circle cx="100" cy="100" r="35" />
            </clipPath>
            <path id={`${uid}-arc`} d="M73 100a27 27 0 0 1 54 0" fill="none" />
          </defs>
          <circle cx="100" cy="100" r="99.5" style={{ fill: "var(--vinyl)" }} />
          {GROOVES.map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" strokeWidth="0.45" style={{ stroke: "var(--vinyl-groove)" }} />
          ))}
          {[58, 69, 81].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" strokeWidth="1.3" style={{ stroke: "var(--vinyl-sheen)" }} />
          ))}
          <circle cx="100" cy="100" r="98.6" fill="none" strokeWidth="0.8" style={{ stroke: "var(--vinyl-sheen)" }} />
          <circle cx="100" cy="100" r="40" fill="none" strokeWidth="2.4" style={{ stroke: "var(--vinyl-groove)" }} />

          {artworkUrl ? (
            <>
              <circle cx="100" cy="100" r="35" style={{ fill: "var(--paper-deep)" }} />
              <image
                href={artworkUrl}
                x="65"
                y="65"
                width="70"
                height="70"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${uid}-label)`}
              />
              <circle cx="100" cy="100" r="35" fill="none" strokeWidth="1" style={{ stroke: "var(--vinyl-sheen)" }} />
            </>
          ) : (
            <>
              <circle cx="100" cy="100" r="35" style={{ fill: accentVar(accent) }} />
              <circle cx="100" cy="100" r="31.5" fill="none" strokeWidth="0.6" style={{ stroke: accentInkVar(accent) }} />
              <text fontSize={label.length > 22 ? 4.6 : 5.6} letterSpacing="0.4" textAnchor="middle" style={{ fill: "var(--ink)", fontFamily: "var(--ff-display)" }}>
                <textPath href={`#${uid}-arc`} startOffset="50%">
                  {truncate(label, 30)}
                </textPath>
              </text>
              {artist ? (
                <text x="100" y="118" fontSize="4.6" textAnchor="middle" style={{ fill: "var(--ink-soft)", fontFamily: "var(--ff-ui)", fontWeight: 600 }}>
                  {truncate(artist, 26)}
                </text>
              ) : null}
              <text x="100" y="125.5" fontSize="3.4" letterSpacing="0.8" textAnchor="middle" style={{ fill: accentInkVar(accent), fontFamily: "var(--ff-postal)" }}>
                33⅓ · SIDE A
              </text>
            </>
          )}
          <circle cx="100" cy="100" r="2.6" strokeWidth="0.6" style={{ fill: "var(--paper)", stroke: "var(--ink-faded)" }} />
        </svg>
      </motion.div>

      {/* Light on the grooves: static while the record turns underneath. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: size * REC.cx - D / 2,
          top: size * REC.cy - D / 2,
          width: D,
          height: D,
          background:
            "conic-gradient(from 18deg, transparent 0deg, var(--vinyl-sheen) 22deg, var(--vinyl-sheen) 30deg, transparent 56deg, transparent 198deg, var(--vinyl-sheen) 202deg, var(--vinyl-sheen) 210deg, transparent 236deg)",
          WebkitMaskImage: "radial-gradient(circle, transparent 36%, black 36.5%, black 99%, transparent 100%)",
          maskImage: "radial-gradient(circle, transparent 36%, black 36.5%, black 99%, transparent 100%)",
        }}
      />

      {/* Arm rest post. */}
      <div
        className="absolute rounded-full"
        style={{ left: size * 0.9 - size * 0.016, top: size * 0.66, width: size * 0.032, height: size * 0.032, background: "var(--ink-faded)" }}
      />

      {/* Tonearm: pivots at the top-right; its shadow shows how high it rides. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ rotate: arm, originX: PIVOT.x, originY: PIVOT.y / 0.88 }}
      >
        <motion.svg
          viewBox="0 0 100 88"
          width={size}
          height={h}
          className="absolute inset-0 overflow-visible"
          style={{ x: shadowX, y: shadowY, opacity: shadowOpacity }}
        >
          <defs>
            <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
          </defs>
          <g filter={`url(#${uid}-soft)`} style={{ stroke: "var(--cast-shadow)", fill: "var(--cast-shadow)" }}>
            <ArmPath />
          </g>
        </motion.svg>
        <svg viewBox="0 0 100 88" width={size} height={h} className="absolute inset-0 overflow-visible">
          <ArmPath body />
        </svg>
      </motion.div>

      {/* Pivot base (does not rotate). */}
      <svg viewBox="0 0 100 88" width={size} height={h} className="pointer-events-none absolute inset-0 overflow-visible">
        <circle cx={PIVOT.x * 100} cy={PIVOT.y * 100} r="6.4" strokeWidth="0.6" style={{ fill: "var(--paper-raised)", stroke: "var(--paper-edge)" }} />
        <circle cx={PIVOT.x * 100} cy={PIVOT.y * 100} r="3.2" style={{ fill: "var(--ink-soft)" }} />
        <circle cx={PIVOT.x * 100 - 0.9} cy={PIVOT.y * 100 - 0.9} r="0.9" style={{ fill: "var(--paper-raised)" }} opacity="0.7" />
      </svg>
    </div>
  );
}

const GROOVES = Array.from({ length: 30 }, (_, i) => 43 + i * 1.8);

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The arm in the 100 × 88 frame, at rest (pointing straight down from the pivot). */
function ArmPath({ body }: { body?: boolean }) {
  const x = PIVOT.x * 100;
  const y = PIVOT.y * 100;
  if (!body) {
    return (
      <>
        <path d={`M${x} ${y} L${x} ${y + 52}`} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <rect x={x - 2.6} y={y + 51} width="5.2" height="10" rx="1.2" transform={`rotate(18 ${x} ${y + 52})`} />
      </>
    );
  }
  return (
    <>
      {/* Counterweight behind the pivot. */}
      <rect x={x - 3} y={y - 9.5} width="6" height="5.5" rx="1.2" strokeWidth="0.5" style={{ fill: "var(--ink-soft)", stroke: "var(--ink)" }} />
      {/* Tube with a highlight. */}
      <path d={`M${x} ${y - 4} L${x} ${y + 52}`} strokeWidth="2.2" strokeLinecap="round" fill="none" style={{ stroke: "var(--ink-faded)" }} />
      <path d={`M${x - 0.45} ${y} L${x - 0.45} ${y + 51}`} strokeWidth="0.6" strokeLinecap="round" fill="none" opacity="0.6" style={{ stroke: "var(--paper-raised)" }} />
      {/* Headshell + cartridge, angled like a real offset headshell. */}
      <g transform={`rotate(18 ${x} ${y + 52})`}>
        <rect x={x - 2.7} y={y + 50.5} width="5.4" height="10.5" rx="1.3" strokeWidth="0.5" style={{ fill: "var(--ink)", stroke: "var(--ink)" }} />
        <rect x={x - 1.8} y={y + 58} width="3.6" height="3.4" rx="0.6" style={{ fill: "var(--wax)" }} />
        <path d={`M${x + 2.6} ${y + 53} l3.4 1.2`} strokeWidth="0.9" strokeLinecap="round" style={{ stroke: "var(--ink-faded)" }} />
      </g>
    </>
  );
}
