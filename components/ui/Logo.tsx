"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { dataSource } from "@/lib/services";
import { useDemo } from "@/lib/state/demo";
import { toast } from "@/lib/state/toast";
import { cn } from "@/lib/utils/cn";
import { scrollToTop } from "@/lib/utils/scroll";

interface LogoProps {
  /** Where the wordmark links to. Pass null to render it without a link (e.g. on the recipient page). */
  href?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "text-[1.7rem]", md: "text-[2.05rem]", lg: "text-[2.8rem]" } as const;

/** A tiny perforated stamp carrying the heart (mirrors the ceramic's heart stamp). */
function StampMark() {
  // Perforations are circles punched out of the stamp's edges with a mask (unique id per instance).
  const maskId = `sd-logo-perf-${useId().replace(/:/g, "")}`;
  return (
    <svg aria-hidden viewBox="0 0 26 30" className="h-[0.9em] w-[0.78em] translate-y-[-0.04em] -rotate-6">
      <defs>
        <mask id={maskId}>
          <rect width="26" height="30" fill="#fff" />
          {[3, 8, 13, 18, 23].map((x) => (
            <g key={x} fill="#000">
              <circle cx={x} cy="0" r="1.45" />
              <circle cx={x} cy="30" r="1.45" />
            </g>
          ))}
          {[3, 7.8, 12.6, 17.4, 22.2, 27].map((y) => (
            <g key={y} fill="#000">
              <circle cx="0" cy={y} r="1.45" />
              <circle cx="26" cy={y} r="1.45" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="26" height="30" rx="0.8" fill="var(--accent-red)" mask={`url(#${maskId})`} />
      <rect x="3.2" y="3.2" width="19.6" height="23.6" fill="none" stroke="var(--paper)" strokeWidth="0.8" opacity="0.55" />
      <path
        d="M13 22.2s-6-3.7-7.5-7.4C4.4 12 6.1 9 9 9c1.6 0 2.8.9 4 2.4 1.2-1.5 2.4-2.4 4-2.4 2.9 0 4.6 3 3.5 5.8-1.5 3.7-7.5 7.4-7.5 7.4z"
        fill="var(--paper-raised)"
      />
    </svg>
  );
}

/**
 * Placeholder wordmark (final logo arrives with the rebrand). A triple-tap within 600 ms
 * toggles the presenter's Demo Panel (MASTER_BUILD_PROMPT §6.2).
 */
export function Logo({ href = "/", size = "md", className }: LogoProps) {
  const taps = useRef<number[]>([]);
  const reduced = useReducedMotionPref();

  const onPointerUp = (e: React.PointerEvent) => {
    // The Demo Panel only exists on mock data (lib/services: NEXT_PUBLIC_DATA_SOURCE).
    if (dataSource !== "mock") return;
    const now = e.timeStamp;
    taps.current = [...taps.current.filter((t) => now - t < 600), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      e.preventDefault();
      const demo = useDemo.getState();
      const enabled = !demo.enabled;
      demo.setEnabled(enabled);
      if (enabled) demo.setOpen(true);
      toast(enabled ? "Demo panel on" : "Demo panel off");
    }
  };

  const mark = (
    <span className={cn("inline-flex items-center gap-[0.22em] font-script leading-none select-none", SIZES[size])}>
      <StampMark />
      <span className="translate-y-[-0.02em]">Saudade</span>
    </span>
  );

  if (href === null) {
    return (
      <span className={cn("inline-block", className)} onPointerUp={onPointerUp}>
        {mark}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn("tap-target inline-flex items-center rounded-soft", className)}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        // Swallow the navigation that the third tap would otherwise trigger.
        if (taps.current.length === 0 && e.detail >= 3) {
          e.preventDefault();
          return;
        }
        // Already on this page (perhaps at /#how): a same-page link wouldn't move, so go back to
        // the top, and drop the #anchor so a reload starts there too.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || window.location.pathname !== href) return;
        e.preventDefault();
        if (window.location.hash) history.replaceState(history.state, "", href);
        scrollToTop({ reduced });
      }}
      aria-label="Saudade home"
    >
      {mark}
    </Link>
  );
}
