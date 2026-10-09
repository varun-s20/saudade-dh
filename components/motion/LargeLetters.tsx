"use client";

/**
 * <LargeLetters>: the 1940s "large-letter" postcard. Each block capital is a window onto a
 * photograph, with a cream outline and a navy extruded side.
 * Motion (Emil Kowalski): the letters land one after another on first paint (a first-time,
 * decorative moment, so it may settle with a touch of overshoot; 55ms stagger), and the whole
 * word leans towards the cursor on a spring (decorative pointer tracking needs momentum, not a
 * 1:1 follow). Mouse only; reduced motion keeps them still. The text stays real text.
 */
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { cn } from "@/lib/utils/cn";
import { finePointer } from "./reduced";
import "./motion.css";

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function LargeLetters({ word, photos, className, delay = 0 }: { word: string; photos: string[]; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionPref();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 110, damping: 16, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 110, damping: 16, mass: 0.7 });
  const rotateY = useTransform(sx, (v) => v * 7);
  const rotateX = useTransform(sy, (v) => v * -6);

  useEffect(() => {
    if (reduced || !finePointer()) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      px.set(clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      py.set(clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, px, py]);

  // Words stay whole (they wrap between words, never inside one); letters count across words
  // so the photographs and the landing stagger run left to right.
  const words = word.split(" ");
  const starts = words.map((_, w) => words.slice(0, w).join("").length);
  return (
    <span ref={ref} className={cn("ll", className)}>
      <motion.span className="ll__word" style={reduced ? undefined : { rotateX, rotateY }}>
        {words.map((w, wi) => (
          <span key={wi} className="ll__w">
            {[...w].map((ch, ci) => {
              const k = starts[wi] + ci;
              return (
                <span
                  key={ci}
                  className="ll__ch"
                  style={{ ["--img" as string]: `url(${photos[k % photos.length]})`, ["--i" as string]: k, ["--ll-delay" as string]: `${delay}ms` } as CSSProperties}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
