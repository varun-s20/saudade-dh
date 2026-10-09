"use client";

/**
 * <HeartSeal>: the wax seal bearing the heart stamp; it mirrors the heart-shaped NFC tap zone
 * on the ceramic. Wax body with an irregular poured edge, a recessed impression and a soft
 * specular highlight. The heart in the impression is the HEART_SEAL artwork from
 * config/stamps.ts, multiplied into the wax so any client art reads as a tone-on-tone imprint.
 *
 * The Motion Designer animates it (lift, crack, press) by wrapping it; this component is static
 * apart from the optional CSS breathing glow (reduced-motion: a calm, still halo).
 */
import { useId, useMemo, type CSSProperties } from "react";
import { HEART_SEAL } from "@/config/stamps";
import { cn } from "@/lib/utils/cn";
import { blobPath, svgId } from "@/components/paper/seeded";
import "./stamps.css";

export interface HeartSealProps {
  /** Diameter in px. Default 72. */
  size?: number;
  /** Soft breathing glow (closed envelope, waiting for the tap). */
  glow?: boolean;
  /** Freshly pressed look (Seal & send ceremony). */
  pressed?: boolean;
  className?: string;
  /** Accessible name. When set the seal is exposed as role="img"; otherwise decorative. */
  label?: string;
  /** Varies the poured wax edge. */
  seed?: number;
  style?: CSSProperties;
}

export function HeartSeal({ size = 72, glow, pressed, className, label, seed = 7, style }: HeartSealProps) {
  const uid = svgId(useId());
  const edge = useMemo(() => blobPath(50, 50, pressed ? 48.2 : 46, seed, 24, pressed ? 0.075 : 0.05), [pressed, seed]);
  const inner = useMemo(() => blobPath(50, 50, 33.5, seed + 3, 18, 0.018), [seed]);

  return (
    <span
      className={cn("sd-seal", className)}
      style={{ width: size, height: size, ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-pressed={pressed || undefined}
    >
      {glow && <span className="sd-seal__glow" />}
      <svg viewBox="0 0 100 100" className="sd-seal__svg" focusable="false">
        <defs>
          <radialGradient id={`${uid}-body`} cx="36%" cy="30%" r="78%">
            <stop offset="0" style={{ stopColor: "var(--wax-highlight)" }} />
            <stop offset="0.42" style={{ stopColor: "var(--wax)" }} />
            <stop offset="1" style={{ stopColor: "var(--wax-shadow)" }} />
          </radialGradient>
          <linearGradient id={`${uid}-well`} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
            <stop offset="0" style={{ stopColor: "var(--wax-shadow)", stopOpacity: 0.75 }} />
            <stop offset="0.55" style={{ stopColor: "var(--wax)", stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: "var(--wax-highlight)", stopOpacity: 0.55 }} />
          </linearGradient>
          <linearGradient id={`${uid}-rim`} x1="0.2" y1="0.15" x2="0.8" y2="0.85">
            <stop offset="0" style={{ stopColor: "var(--wax-shadow)" }} />
            <stop offset="1" style={{ stopColor: "var(--wax-highlight)" }} />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <path d={inner} />
          </clipPath>
          <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          {/* Turn the artwork's darkness into an impression in the wax: alpha = 1.1 − 1.2·G
              (cream paper vanishes; reds and ink lines press in), coloured with a wax token. */}
          {(["shade", "lift"] as const).map((k) => (
            <filter key={k} id={`${uid}-${k}`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 -1.2 0 0 1.1" result="a" />
              <feComposite in="a" in2="SourceAlpha" operator="in" result="m" />
              <feFlood style={{ floodColor: k === "shade" ? "var(--wax-shadow)" : "var(--wax-highlight)" }} />
              <feComposite in2="m" operator="in" />
            </filter>
          ))}
        </defs>

        {/* Poured wax */}
        <path d={edge} fill={`url(#${uid}-body)`} />
        {/* Squeeze-out ridge, catching light on the upper left */}
        <path d={edge} fill="none" strokeWidth="1.2" style={{ stroke: "var(--wax-highlight)", strokeOpacity: pressed ? 0.6 : 0.35 }} transform="translate(-0.4 -0.5)" />

        {/* Impression well */}
        <path d={inner} style={{ fill: "var(--wax)" }} />
        <path d={inner} fill={`url(#${uid}-well)`} />
        <g clipPath={`url(#${uid}-clip)`}>
          {/* Raised relief lit from the upper left: a highlight copy offset up-left, the shade on top. */}
          <image href={HEART_SEAL.src} x="9" y="10" width="82" height="82" filter={`url(#${uid}-lift)`} opacity={pressed ? 0.85 : 0.7} transform="translate(-0.8 -0.9)" preserveAspectRatio="xMidYMid meet" />
          <image href={HEART_SEAL.src} x="9" y="10" width="82" height="82" filter={`url(#${uid}-shade)`} opacity={pressed ? 0.95 : 0.85} preserveAspectRatio="xMidYMid meet" />
        </g>
        <path d={inner} fill="none" strokeWidth="1.6" stroke={`url(#${uid}-rim)`} />

        {/* Specular highlight */}
        <ellipse
          cx="33"
          cy="25"
          rx="11"
          ry="4.2"
          transform="rotate(-32 33 25)"
          filter={`url(#${uid}-soft)`}
          style={{ fill: "var(--paper-raised)", opacity: pressed ? 0.6 : 0.38 }}
        />
        {pressed && (
          <path
            d="M70 79c5-4 9-10 10-17"
            fill="none"
            strokeWidth="1.4"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
            style={{ stroke: "var(--paper-raised)", opacity: 0.45 }}
          />
        )}
      </svg>
    </span>
  );
}
