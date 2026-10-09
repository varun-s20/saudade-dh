"use client";

/**
 * Scroll-scrubbed pieces (D-069), after patterns studied on later.com, linktr.ee and pitch.com
 * (patterns only). Tied to scroll position, so they follow the finger exactly and need no easing
 * of their own; transform, opacity and clip-path only. Reduced motion: the finished state.
 *
 * <ExpandBand>  a section that grows from a rounded inset card to the full width as it arrives.
 * <ScrollFill>  a sentence whose words fill in, one after another, as it scrolls through.
 */
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";

export function ExpandBand({ className, children, ...aria }: { className?: string; children: ReactNode; "aria-labelledby"?: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] });
  const clipPath = useTransform(scrollYProgress, [0, 1], ["inset(0% 7% 0% 7% round 40px)", "inset(0% 0% 0% 0% round 0px)"]);
  return (
    <motion.section ref={ref} className={className} style={reduced ? undefined : { clipPath }} {...aria}>
      {children}
    </motion.section>
  );
}

export function ScrollFill({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "end 52%"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <Word key={i} p={scrollYProgress} from={i / words.length} to={(i + 1) / words.length} reduced={reduced}>
            {w}
          </Word>
        ))}
      </span>
    </p>
  );
}

function Word({ p, from, to, reduced, children }: { p: MotionValue<number>; from: number; to: number; reduced: boolean; children: string }) {
  const opacity = useTransform(p, [from, to], [0.18, 1]);
  return (
    <>
      <motion.span style={{ opacity: reduced ? 1 : opacity }}>{children}</motion.span>{" "}
    </>
  );
}
