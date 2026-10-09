"use client";

/**
 * <CoverStack>: one section scrolls up over the one before it, like a postcard dealt on top.
 * The `under` section scrolls normally until its bottom reaches the bottom of the screen (so all
 * of it is read, however tall it is on a phone), then holds still while `over` slides up across
 * it. The hold ends with the pair, so nothing lingers behind the sections that follow.
 * Motion (Emil Kowalski): scroll-driven, so it follows the finger exactly; the section underneath
 * sinks back a little as it's covered (scale and dim, CSS scroll-driven animation where
 * supported, nothing where not). Reduced motion: it still stacks, without the sink.
 */
import { useEffect, useRef, type ReactNode } from "react";
import "./motion.css";

export function CoverStack({ under, over }: { under: ReactNode; over: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // The hold point depends on the section's height (top = screen height − its height), which
  // changes with the screen and the fonts, so it is measured, not guessed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => el.style.setProperty("--cs-h", `${Math.ceil(e.borderBoxSize[0].blockSize)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="cs">
      <div ref={ref} className="cs__under">
        <div className="cs__sink">{under}</div>
      </div>
      <div className="cs__over">{over}</div>
    </div>
  );
}
