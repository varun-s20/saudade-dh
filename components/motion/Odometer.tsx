"use client";

/**
 * <Odometer>: the oatly.com counter. Each digit is a drum that rolls up to its number when it
 * scrolls into view, then the row gives a small 3D "maxed out" wobble as it lands.
 * Screen readers get the plain value; the drums are decorative. Reduced motion: the final
 * number, still.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { cn } from "@/lib/utils/cn";
import "./motion.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Odometer({ value, className, delay = 0 }: { value: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionPref();
  const [state, setState] = useState<"rest" | "armed" | "rolling" | "landed">("rest");

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setState("rolling");
        t = setTimeout(() => setState("landed"), 1150 + delay + value.length * 90);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    const raf = requestAnimationFrame(() => {
      setState((s) => (s === "rest" ? "armed" : s));
      io.observe(el);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      io.disconnect();
    };
  }, [reduced, delay, value.length]);

  const chars = [...value];
  const digitIndex = chars.map((_, k) => chars.slice(0, k).filter((c) => /\d/.test(c)).length);
  return (
    <span ref={ref} className={cn("od", className)} data-state={state}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="od__row" style={{ ["--od-delay" as string]: `${delay}ms` } as CSSProperties}>
        {chars.map((ch, k) =>
          /\d/.test(ch) ? (
            <span key={k} className="od__drum">
              <span className="od__strip" style={{ ["--n" as string]: Number(ch), ["--k" as string]: digitIndex[k] } as CSSProperties}>
                {DIGITS.map((g) => (
                  <span key={g}>{g}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={k} className="od__sep">
              {ch}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
