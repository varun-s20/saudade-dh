"use client";

/**
 * <InView>: arms a reveal after hydration and releases it once, when the element scrolls into
 * view (IntersectionObserver, -10% bottom margin). The look lives in CSS (globals.css):
 *   iv-clip  – a picture clipped up from its bottom edge
 *   iv-write – written on, left to right, at handwriting speed
 *   iv-stick – children land like stickers, one after another (give each child --i)
 *   iv-rise  – children rise into place (give each child --i)
 *   iv-thunk – a rubber stamp coming down on the paper (scale + turn + ink)
 * Nothing is hidden before JavaScript runs, and reduced motion skips the arming entirely.
 *
 * Clip effects hide the element with its own clip-path, and Chromium's IntersectionObserver
 * honours a target's clip-path: a fully clipped element never reports as visible. So for those we
 * observe the (unclipped) parent, and while it's on screen check the element's own box on scroll
 * (getBoundingClientRect ignores clip-path).
 */
import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { cn } from "@/lib/utils/cn";

export function InView({
  as: Tag = "div",
  effect,
  className,
  delay = 0,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  effect: "clip" | "write" | "stick" | "rise" | "thunk";
  className?: string;
  delay?: number;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  role?: string;
  /** For a region that scrolls sideways: keyboard users must be able to focus it. */
  tabIndex?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();
  const [state, setState] = useState<"idle" | "armed" | "in">("idle");

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const clipped = effect === "clip" || effect === "write";
    const target = clipped ? (el.parentElement ?? el) : el;
    let frame = 0;
    let listening = false;

    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.9 && r.bottom > 0;
    };
    const release = () => {
      setState("in");
      io.disconnect();
      stopListening();
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (inView()) release();
      });
    };
    const stopListening = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!clipped) {
          if (e.isIntersecting) release();
          return;
        }
        if (!e.isIntersecting) return stopListening();
        if (inView()) return release();
        if (!listening) {
          listening = true;
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll, { passive: true });
        }
      },
      { rootMargin: clipped ? "0px" : "0px 0px -10% 0px" },
    );
    const raf = requestAnimationFrame(() => {
      setState((s) => (s === "idle" ? "armed" : s));
      io.observe(target);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(frame);
      io.disconnect();
      stopListening();
    };
  }, [reduced, effect]);

  return (
    <Tag
      ref={ref}
      className={cn(`iv-${effect}`, className)}
      data-armed={state !== "idle" || undefined}
      data-in={state === "in" || undefined}
      style={delay ? ({ ...style, ["--iv-delay" as string]: `${delay}ms` } as CSSProperties) : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
