"use client";

/**
 * <Postmark>: a hand-cancelled circular date stamp. Original drawing built from the real
 * anatomy of a cancellation (double ring, place on the arc, date band, optional wavy "killer"
 * lines) with ink imperfection: displaced edges, uneven coverage and speckle voids.
 *
 * Decorative by default (aria-hidden). Pass `title` to expose it as an image with a label.
 */
import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { hashSeed, r2, seeded, svgId } from "./seeded";

export type PostmarkInk = "postmark" | "red" | "terracotta";

export interface PostmarkProps {
  /** ISO date ("2026-10-08…") printed in the ring as "08 OCT / 2026", or preformatted text. Omit for an undated mark. */
  date?: string;
  /** Text around the ring (top arc), e.g. "SAUDADE · BY HAND". */
  place?: string;
  /** "circle" = round cancellation; "wavy" = circle + wavy cancellation lines; "new" = small "NEW" mark. */
  variant?: "circle" | "wavy" | "new";
  /** Diameter of the ring in px. Default 88. (A wavy mark is wider: 2 × size.) */
  size?: number;
  rotate?: number;
  /** Ink colour token name. Default postmark (red for the "new" variant). */
  ink?: PostmarkInk;
  className?: string;
  /** Optional text on the lower arc. Default: three small stars. */
  bottom?: string;
  /** Which side of the ring the wavy lines run. Default "right". */
  wavySide?: "left" | "right";
  /** Varies the ink imperfection. Default derived from the text, so it is stable. */
  seed?: number;
  /** Ink opacity, 0..1. Default 0.88. */
  opacity?: number;
  style?: CSSProperties;
  /** Accessible label. When set, the mark is exposed as role="img". */
  title?: string;
}

const INK_VAR: Record<PostmarkInk, string> = {
  postmark: "var(--postmark)",
  red: "var(--accent-red)",
  terracotta: "var(--accent-terracotta-ink)",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-10-08…" → ["08 OCT", "2026"]. Parsed from the string itself (no Date), so SSR = client. */
export function postmarkDateParts(input: string): [string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
  if (m) return [`${m[3]} ${MONTHS[Number(m[2]) - 1] ?? ""}`.trim(), m[1]];
  const parts = input.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 3) return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
  return [input.trim().toUpperCase(), ""];
}

const RING = 100;
const LINES_W = 100;

/** Font size so `text` fits along an arc of `arc` units in the postal face (≈0.72em per glyph incl. tracking; generous for Karla's tracked capitals). */
const fitSize = (text: string, arc: number, max: number) => r2(Math.min(max, arc / (Math.max(text.length, 1) * 0.74)));

function starPath(cx: number, cy: number, r: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    d += `${i === 0 ? "M" : "L"}${r2(cx + rr * Math.cos(a))} ${r2(cy + rr * Math.sin(a))}`;
  }
  return `${d}Z`;
}

const HEART =
  "M50 60.5C44 56.6 40 52.6 40 48.3C40 45.4 42.1 43.4 44.7 43.4C46.7 43.4 48.6 44.6 50 46.6C51.4 44.6 53.3 43.4 55.3 43.4C57.9 43.4 60 45.4 60 48.3C60 52.6 56 56.6 50 60.5Z";

function wavyLines(x0: number, seed: number): string {
  const rnd = seeded(seed + 17);
  let d = "";
  for (const y of [29, 39.5, 50, 60.5, 71]) {
    const len = LINES_W - 6 - rnd() * 12;
    const w = 21;
    const amp = 3.3;
    let x = x0 + rnd() * 3;
    d += `M${r2(x)} ${y}q${w / 4} ${-amp} ${w / 2} 0`;
    x += w / 2;
    while (x < x0 + len) {
      d += `t${w / 2} 0`;
      x += w / 2;
    }
  }
  return d;
}

export function Postmark({
  date,
  place = "SAUDADE",
  variant = "circle",
  size = 88,
  rotate = 0,
  ink,
  className,
  bottom,
  wavySide = "right",
  seed,
  opacity = 0.88,
  style,
  title,
}: PostmarkProps) {
  const uid = svgId(useId());
  const s = seed ?? hashSeed(`${place}|${date ?? ""}|${variant}`) % 997;
  const isNew = variant === "new";
  const wavy = variant === "wavy";
  const vbW = wavy ? RING + LINES_W : RING;
  const ox = wavy && wavySide === "left" ? LINES_W : 0;
  const inkVar = INK_VAR[ink ?? (isNew ? "red" : "postmark")];
  const upper = place.toUpperCase();
  const topSize = fitSize(upper, isNew ? 70 : 88, isNew ? 9 : 10.5);
  const bottomText = bottom?.toUpperCase();
  const [d1, d2] = date ? postmarkDateParts(date) : ["", ""];

  return (
    <svg
      viewBox={`0 0 ${vbW} ${RING}`}
      width={r2((size * vbW) / RING)}
      height={size}
      className={cn("pointer-events-none select-none mix-blend-multiply", className)}
      style={{ color: inkVar, opacity, transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <filter id={`${uid}-ink`} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={2} seed={s} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={s + 5} result="b" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.1 0 0 0 -0.12" result="m" />
          <feComposite in="d" in2="m" operator="in" result="inked" />
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves={1} seed={s + 9} result="s" />
          <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -8 5.9" result="sp" />
          <feComposite in="inked" in2="sp" operator="in" />
        </filter>
        <path id={`${uid}-top`} d="M14.5 50A35.5 35.5 0 0 1 85.5 50" fill="none" />
        <path id={`${uid}-bot`} d="M7 50A43 43 0 0 0 93 50" fill="none" />
      </defs>

      <g filter={`url(#${uid}-ink)`} fill="currentColor" stroke="currentColor">
        <g transform={ox ? `translate(${ox} 0)` : undefined}>
          <circle cx="50" cy="50" r="47" fill="none" strokeWidth="2.7" />
          <circle cx="50" cy="50" r={isNew ? 33 : 31.5} fill="none" strokeWidth="1.5" />

          <text stroke="none" fontSize={topSize} letterSpacing={r2(topSize * 0.12)} style={{ fontFamily: "var(--ff-postal)" }}>
            <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
              {upper}
            </textPath>
          </text>

          {bottomText ? (
            <text stroke="none" fontSize={fitSize(bottomText, 80, 8.5)} letterSpacing="1" style={{ fontFamily: "var(--ff-postal)" }}>
              <textPath href={`#${uid}-bot`} startOffset="50%" textAnchor="middle">
                {bottomText}
              </textPath>
            </text>
          ) : (
            <path stroke="none" d={`${starPath(50, 89.5, 3)}${starPath(38.5, 87, 2.2)}${starPath(61.5, 87, 2.2)}`} />
          )}

          {isNew ? (
            <>
              <text x="50" y="58.5" stroke="none" fontSize="23" textAnchor="middle" letterSpacing="1.2" style={{ fontFamily: "var(--ff-postal)" }}>
                NEW
              </text>
              <path d="M27 37.5h46M27 64.5h46" strokeWidth="1.4" fill="none" />
            </>
          ) : date ? (
            <>
              <path d="M21 39h58M21 63.5h58" strokeWidth="1.3" fill="none" />
              <text x="50" y="52.5" stroke="none" fontSize={d1.length > 6 ? 9 : 11.5} textAnchor="middle" letterSpacing="0.6" style={{ fontFamily: "var(--ff-postal)" }}>
                {d1}
              </text>
              {d2 && (
                <text x="50" y="61" stroke="none" fontSize="7.5" textAnchor="middle" letterSpacing="1.6" style={{ fontFamily: "var(--ff-postal)" }}>
                  {d2}
                </text>
              )}
            </>
          ) : (
            <>
              <path d="M21 39h58M21 63.5h58" strokeWidth="1.3" fill="none" />
              <path d={HEART} stroke="none" />
            </>
          )}
        </g>

        {wavy && <path d={wavyLines(wavySide === "left" ? 0 : RING + 2, s)} fill="none" strokeWidth="2.5" strokeLinecap="round" />}
      </g>
    </svg>
  );
}
