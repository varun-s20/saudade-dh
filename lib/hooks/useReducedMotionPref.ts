"use client";

import { useReducedMotion } from "motion/react";
import { useDemo } from "@/lib/state/demo";

/**
 * True when animations should use their reduced-motion variant: the system preference
 * (prefers-reduced-motion / iOS "Reduce Motion"), overridden by the Demo Panel toggle.
 */
export function useReducedMotionPref(): boolean {
  const system = useReducedMotion();
  const override = useDemo((s) => s.motion);
  if (override === "reduce") return true;
  if (override === "full") return false;
  return Boolean(system);
}
