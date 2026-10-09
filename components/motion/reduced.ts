/** Same rule as useReducedMotionPref, for code outside React render (event handlers, rAF loops). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const override = document.documentElement.dataset.motion;
  if (override === "reduce") return true;
  if (override === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Mouse-like pointer (hover effects and cursor parallax only make sense there). */
export const finePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
