"use client";

/**
 * <VoiceObject>: the voice stamp's object, a cathedral-style wireless set (original drawing,
 * painted in the voice stamp's sage).
 *
 * - `playing`: the dial lamp warms up, the tuning needle sweeps onto the station (one soft
 *   settle, like a real needle), and the speaker cloth glows.
 * - `level` (0..1, number or MotionValue): the speaker glow breathes with the voice and the needle
 *   trembles very slightly. Without a level the glow is steady and the needle drifts a hair.
 * - Reduced motion: lamp and glow crossfade on/off, the needle is placed (no sweep, no tremble).
 * Decorative (aria-hidden): the accessible player is a separate control built by the voice world.
 */
import {
  animate,
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { useEffect, useId, useRef } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { ease } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";

export interface VoiceObjectProps {
  playing: boolean;
  /** Loudness 0..1 (e.g. from an AnalyserNode). A MotionValue avoids re-rendering every frame. */
  level?: number | MotionValue<number>;
  /** Width in px. Height = 1.1 × size. Default 220. */
  size?: number;
  className?: string;
}

/** Needle x positions on the dial (viewBox units): resting off-station, and on the station. */
const NEEDLE_OFF = 76;
const NEEDLE_ON = 113;

const isMV = (v: unknown): v is MotionValue<number> => typeof v === "object" && v !== null && "get" in v && "set" in v;

export function VoiceObject({ playing, level, size = 220, className }: VoiceObjectProps) {
  const reduced = useReducedMotionPref();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hasLevel = level !== undefined;

  const ownLevel = useMotionValue(typeof level === "number" ? level : 0);
  const source = isMV(level) ? level : ownLevel;
  const smooth = useSpring(source, { stiffness: 260, damping: 30 });
  useEffect(() => {
    if (typeof level === "number") ownLevel.set(Math.max(0, Math.min(1, level)));
  }, [level, ownLevel]);

  const lamp = useMotionValue(0);
  const needle = useMotionValue(NEEDLE_OFF);
  const drift = useMotionValue(0);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const runs: AnimationPlaybackControls[] = [];
    if (reduced) {
      needle.set(playing ? NEEDLE_ON : NEEDLE_OFF);
      runs.push(animate(lamp, playing ? 1 : 0, { duration: 0.2, ease: ease.out }));
    } else if (playing) {
      runs.push(animate(lamp, 1, { duration: 0.7, ease: ease.out }));
      runs.push(animate(needle, NEEDLE_ON, { type: "spring", stiffness: 70, damping: 13, mass: 1 }));
    } else {
      runs.push(animate(lamp, 0, { duration: 0.9, ease: ease.inOut }));
      runs.push(animate(needle, NEEDLE_OFF, { duration: 0.8, ease: ease.inOut }));
    }
    return () => runs.forEach((r) => r.stop());
  }, [playing, reduced, lamp, needle]);

  // A hair of life on the needle while playing (never under reduced motion).
  useAnimationFrame((t) => {
    if (!playingRef.current || reduced) {
      if (drift.get() !== 0) drift.set(0);
      return;
    }
    const lv = hasLevel ? smooth.get() : 0;
    drift.set(Math.sin(t / 700) * 0.5 + Math.sin(t / 97) * lv * 1.4);
  });

  const needleX = useTransform(() => needle.get() - NEEDLE_OFF + drift.get());
  const knob = useTransform(needleX, (x) => x * 4);
  const speakerGlow = useTransform(() => lamp.get() * (hasLevel && !reduced ? 0.55 + smooth.get() * 0.45 : 0.8));

  return (
    <div aria-hidden className={cn("relative select-none", className)} style={{ width: size, height: size * 1.1 }} data-voice={playing ? "playing" : "idle"}>
      <svg viewBox="0 0 200 220" width={size} height={size * 1.1} className="block overflow-visible">
        <defs>
          <clipPath id={`${uid}-grille`}>
            <path d="M54 140V102C54 72 74 50 100 50s46 22 46 52v38Z" />
          </clipPath>
          <radialGradient id={`${uid}-glow`} cx="50%" cy="60%" r="60%">
            <stop offset="0" style={{ stopColor: "var(--dial-glow)" }} />
            <stop offset="1" style={{ stopColor: "var(--dial-glow)", stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent-sage)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent-sage-ink)" }} />
          </linearGradient>
        </defs>

        {/* Soft shadow on the desk. */}
        <ellipse cx="100" cy="212" rx="78" ry="6" style={{ fill: "var(--cast-shadow)" }} opacity="0.55" />

        {/* Cabinet. */}
        <path d="M24 206V96C24 48 58 16 100 16s76 32 76 80v110Z" style={{ fill: `url(#${uid}-wood)` }} />
        <path d="M24 206V96C24 48 58 16 100 16s76 32 76 80v110Z" fill="none" strokeWidth="2" style={{ stroke: "var(--accent-sage-ink)" }} />
        <path d="M34 198V98c0-40 29-70 66-70s66 30 66 70v100Z" style={{ fill: "var(--accent-sage)" }} />
        <path d="M34 198V98c0-40 29-70 66-70s66 30 66 70v100Z" fill="none" strokeWidth="1" opacity="0.6" style={{ stroke: "var(--accent-sage-ink)" }} />
        <path d="M40 104c0-36 26-64 60-64" fill="none" strokeWidth="2.2" strokeLinecap="round" opacity="0.35" style={{ stroke: "var(--paper-raised)" }} />

        {/* Speaker cloth, its glow, and the fretwork. */}
        <path d="M54 140V102C54 72 74 50 100 50s46 22 46 52v38Z" style={{ fill: "var(--paper-deep)" }} />
        <g clipPath={`url(#${uid}-grille)`}>
          <motion.rect x="40" y="40" width="120" height="110" style={{ fill: `url(#${uid}-glow)`, opacity: speakerGlow }} />
          {[62, 73, 84, 95, 106, 117, 128].map((x) => (
            <rect key={x} x={x} y="44" width="5" height="100" rx="2.5" style={{ fill: "var(--accent-sage-ink)" }} />
          ))}
          <path d="M54 92c14-6 30-9 46-9s32 3 46 9" fill="none" strokeWidth="3" style={{ stroke: "var(--accent-sage-ink)" }} />
        </g>
        <path d="M54 140V102C54 72 74 50 100 50s46 22 46 52v38Z" fill="none" strokeWidth="2.5" style={{ stroke: "var(--accent-sage-ink)" }} />

        {/* Dial: lamp behind the glass, scale, needle. */}
        <rect x="60" y="150" width="80" height="24" rx="12" strokeWidth="2" style={{ fill: "var(--paper-raised)", stroke: "var(--accent-sage-ink)" }} />
        <motion.rect x="61" y="151" width="78" height="22" rx="11" style={{ fill: "var(--dial-glow)", opacity: lamp }} />
        {DIAL_TICKS.map((x, i) => (
          <line key={x} x1={x} x2={x} y1="155" y2={i % 3 === 0 ? 161 : 158.5} strokeWidth="0.7" style={{ stroke: "var(--ink-soft)" }} />
        ))}
        {[
          [72, "55"],
          [88, "70"],
          [104, "90"],
          [120, "120"],
          [131, "160"],
        ].map(([x, t]) => (
          <text key={t} x={x} y="169" fontSize="4.4" textAnchor="middle" style={{ fill: "var(--ink-soft)", fontFamily: "var(--ff-postal)" }}>
            {t}
          </text>
        ))}
        <motion.line x1={NEEDLE_OFF} x2={NEEDLE_OFF} y1="152.5" y2="171.5" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: "var(--accent-red)", x: needleX }} />

        {/* Knobs (the tuning knob turns with the needle). */}
        {[46, 154].map((cx) => (
          <circle key={cx} cx={cx} cy="186" r="10" style={{ fill: "var(--ink-soft)" }} />
        ))}
        <circle cx="46" cy="186" r="7.2" style={{ fill: "var(--ink)" }} />
        <line x1="46" x2="46" y1="179.5" y2="183.5" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: "var(--paper-raised)" }} />
        {/* Rotates about its own box centre, which is the knob centre. */}
        <motion.g style={{ rotate: knob }}>
          <circle cx="154" cy="186" r="7.2" style={{ fill: "var(--ink)" }} />
          <line x1="154" x2="154" y1="179.5" y2="183.5" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: "var(--paper-raised)" }} />
        </motion.g>

        {/* Maker's plate and feet. */}
        <rect x="80" y="193" width="40" height="8" rx="1.5" style={{ fill: "var(--accent-sage-ink)" }} />
        <text x="100" y="199" fontSize="4.6" letterSpacing="1.2" textAnchor="middle" style={{ fill: "var(--paper-raised)", fontFamily: "var(--ff-postal)" }}>
          SAUDADE
        </text>
        <rect x="38" y="205" width="16" height="5" rx="1.5" style={{ fill: "var(--accent-sage-ink)" }} />
        <rect x="146" y="205" width="16" height="5" rx="1.5" style={{ fill: "var(--accent-sage-ink)" }} />
      </svg>
    </div>
  );
}

const DIAL_TICKS = Array.from({ length: 22 }, (_, i) => 66 + i * 3.2);
