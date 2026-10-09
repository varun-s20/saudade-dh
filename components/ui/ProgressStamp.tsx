"use client";

/**
 * <ProgressStamp>: progress as a cancellation ring being inked, tick by tick, clockwise from
 * the top. Ticks change opacity only (no stroke animation). `value` undefined = indeterminate:
 * an inked tail circles the ring (still, under reduced motion). At 1 a tick mark is stamped in.
 */
import { cn } from "@/lib/utils/cn";
import { r2 } from "@/components/paper/seeded";
import "./ui.css";

export interface ProgressStampProps {
  /** 0..1, or undefined for indeterminate. */
  value?: number;
  /** Accessible name, also printed under the ring unless `showLabel` is false. */
  label: string;
  /** Ring diameter in px. Default 88. */
  size?: number;
  /** Print the percentage in the centre. Default true. */
  showValue?: boolean;
  /** Print the label under the ring. Default true. */
  showLabel?: boolean;
  /** Ink colour. Default postmark blue. */
  ink?: "postmark" | "terracotta" | "sage";
  className?: string;
}

const TICKS = 36;
const INK = { postmark: "var(--postmark)", terracotta: "var(--accent-terracotta-ink)", sage: "var(--accent-sage-ink)" } as const;

const TICK_PATHS = Array.from({ length: TICKS }, (_, i) => {
  const a = -Math.PI / 2 + (i / TICKS) * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return `M${r2(50 + 37 * c)} ${r2(50 + 37 * s)}L${r2(50 + 44.5 * c)} ${r2(50 + 44.5 * s)}`;
});

export function ProgressStamp({ value, label, size = 88, showValue = true, showLabel = true, ink = "postmark", className }: ProgressStampProps) {
  const indeterminate = value === undefined || Number.isNaN(value);
  const v = indeterminate ? 0 : Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  const on = Math.round(v * TICKS);
  const done = !indeterminate && v >= 1;

  return (
    <div
      className={cn("sd-progress", className)}
      style={{ color: INK[ink] }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuetext={indeterminate ? undefined : done ? "Done" : `${pct}%`}
      aria-busy={!done || undefined}
    >
      <svg className="sd-progress__svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false">
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
        <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1.3" opacity={done ? 0.95 : 0.55} />
        <g className={indeterminate ? "sd-progress__sweep" : undefined} stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
          {TICK_PATHS.map((d, i) =>
            indeterminate ? (
              <path key={i} d={d} style={{ opacity: r2(0.1 + 0.85 * (i / (TICKS - 1)) ** 2.2) }} />
            ) : (
              <path key={i} d={d} className="sd-progress__tick" data-on={i < on} />
            ),
          )}
        </g>
        {done ? (
          <path
            className="sd-progress__done"
            d="M37.5 51.5l8.5 8.2L63 41.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          showValue &&
          !indeterminate && (
            <text x="50" y="55.5" textAnchor="middle" fontSize="15" fill="currentColor" className="sd-progress__value">
              {pct}%
            </text>
          )
        )}
      </svg>
      {showLabel && <span className="sd-progress__label">{label}</span>}
    </div>
  );
}
