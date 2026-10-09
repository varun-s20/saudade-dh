"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Border-box size of an element, measured before first paint (layout effect) and kept current
 * with a ResizeObserver. Returns 0×0 during SSR and the hydration render.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      // Untransformed size: offsetWidth/Height ignore transforms (an element mid-animation still
      // reports its layout size).
      const width = el.offsetWidth || r.width;
      const height = el.offsetHeight || r.height;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
