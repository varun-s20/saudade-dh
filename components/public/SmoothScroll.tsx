"use client";

/**
 * Smooth, seamless scrolling on the public pages (D-070): Lenis eases wheel and trackpad input so
 * the scroll-scrubbed scenes glide instead of stepping. Touch keeps the phone's own native
 * scrolling (already smooth, and what people expect). Reduced motion: off, native scrolling.
 * Anything that scrolls on its own (menus, dialogs, the demo panel) opts out with
 * `data-lenis-prevent`. In-page anchors (/#how) glide too, landing at their scroll-margin-top
 * (just under the header). Lenis's own stylesheet rules live in public.css.
 */
import type Lenis from "lenis";
import { useEffect } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { setScroller } from "@/lib/utils/scroll";

export function SmoothScroll() {
  const reduced = useReducedMotionPref();
  useEffect(() => {
    if (reduced) return;
    // Loaded on demand, so it never joins a shared bundle (the recipient's route stays lean).
    let lenis: Lenis | null = null;
    let cancelled = false;
    void import("lenis").then(({ default: L }) => {
      if (cancelled) return;
      lenis = new L({
        autoRaf: true,
        lerp: 0.11,
        wheelMultiplier: 1,
        // the targets' own scroll-margin-top clears the header (Lenis honours it); an offset
        // here as well would count the header twice
        anchors: true,
        prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent], dialog, [role='dialog']")),
      });
      setScroller(lenis);
    });
    return () => {
      cancelled = true;
      setScroller(null);
      lenis?.destroy();
    };
  }, [reduced]);
  return null;
}
