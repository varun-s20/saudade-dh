"use client";

/**
 * <PaperLoader>: an on-brand "something is coming" state: an ink dot travelling a postmark ring,
 * pulsing as it goes, with a handwritten caption. Under reduced motion it rests at the top of
 * the ring (a still, inked mark), and the caption carries the meaning.
 */
import { cn } from "@/lib/utils/cn";
import "./ui.css";

export interface PaperLoaderProps {
  /** Accessible status text, also shown as the caption. Default "Loading…". */
  label?: string;
  /** Show the caption visually (it is always announced). Default true. */
  showLabel?: boolean;
  /** Ring diameter in px. Default 56. */
  size?: number;
  className?: string;
}

export function PaperLoader({ label = "Loading…", showLabel = true, size = 56, className }: PaperLoaderProps) {
  return (
    <div className={cn("sd-loader", className)} role="status" aria-live="polite">
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.55" />
        <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 3.2" opacity="0.45" />
        <path
          d="M50 61C43.5 56.6 40 52.8 40 48.3 40 45.4 42.2 43.3 44.8 43.3c2 0 3.9 1.1 5.2 3.1 1.3-2 3.2-3.1 5.2-3.1 2.6 0 4.8 2.1 4.8 5 0 4.5-3.5 8.3-10 12.7z"
          fill="currentColor"
          opacity="0.35"
        />
        <g className="sd-loader__orbit">
          <circle className="sd-loader__dot" cx="50" cy="10" r="6.5" fill="currentColor" />
        </g>
      </svg>
      <span className={showLabel ? "sd-loader__label" : "sr-only"}>{label}</span>
    </div>
  );
}
