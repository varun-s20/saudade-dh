"use client";

/**
 * <StampCursor>: the site's cursor on desktops. A navy dot sits exactly on the pointer, with a
 * postmark ring that trails it on a spring; over anything you can click, the ring turns into the
 * logo's red heart stamp, which presses down while the button is held (a rubber stamp coming
 * down). Over the postcard rack it says "Drag".
 *
 * Only for a mouse or trackpad on a screen at least 1024px wide; phones, tablets and narrow
 * windows keep their own pointer. Text fields, embedded players and anything marked
 * `data-native-cursor` (the admin) get the system cursor back. Until this mounts, the system
 * cursor shows (progressive enhancement). Reduced motion: the ring follows without the spring.
 * Motion (Emil Kowalski): the dot is set directly on every move (never lags the hand); only the
 * ring springs, so it reads as "following" while clicks land exactly where the dot is. State
 * changes are opacity and scale only.
 */
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";

const QUERY = "(hover: hover) and (pointer: fine) and (min-width: 64rem)";
const NATIVE = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"]), textarea, select, iframe, [contenteditable="true"], [data-native-cursor]';
const CLICKABLE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], summary, label[for], .sd-upload';
const DRAG = ".rk__viewport, [data-cursor='drag']";

type Mode = "hidden" | "default" | "link" | "drag";

export function StampCursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("hidden");
  const [down, setDown] = useState(false);
  const reduced = useReducedMotionPref();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const spring = { stiffness: 900, damping: 55, mass: 0.5 };
  const rx = useSpring(x, spring);
  const ry = useSpring(y, spring);

  // On only for a fine pointer on a wide screen; follows window resizes and device changes.
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("has-stamp-cursor");
    const place = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      if (reduced) {
        rx.jump(e.clientX);
        ry.jump(e.clientY);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        setMode("hidden");
        return;
      }
      place(e);
      const t = e.target instanceof Element ? e.target : null;
      const next: Mode = !t || t.closest(NATIVE) ? "hidden" : t.closest(DRAG) ? "drag" : t.closest(CLICKABLE) ? "link" : "default";
      setMode((m) => {
        // first appearance: start the ring on the pointer, not flying in from the corner
        if (m === "hidden" && next !== "hidden") {
          rx.jump(e.clientX);
          ry.jump(e.clientY);
        }
        return next;
      });
    };
    const onLeave = () => setMode("hidden");
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      root.classList.remove("has-stamp-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [enabled, reduced, x, y, rx, ry]);

  if (!enabled) return null;
  return (
    <div aria-hidden className="sc" data-mode={mode} data-down={down || undefined}>
      <motion.div className="sc__follow" style={{ x: rx, y: ry }}>
        <span className="sc__ring" />
        <span className="sc__stamp">
          <span className="sc__stamp-face">
            <svg viewBox="0 0 26 30">
              <rect x="3.2" y="3.2" width="19.6" height="23.6" fill="none" stroke="var(--paper-raised)" strokeWidth="0.9" opacity="0.6" />
              <path d="M13 22.2s-6-3.7-7.5-7.4C4.4 12 6.1 9 9 9c1.6 0 2.8.9 4 2.4 1.2-1.5 2.4-2.4 4-2.4 2.9 0 4.6 3 3.5 5.8-1.5 3.7-7.5 7.4-7.5 7.4z" fill="var(--paper-raised)" />
            </svg>
          </span>
        </span>
        <span className="sc__drag">
          <svg viewBox="0 0 24 12">
            <path d="M1 6h22M5 2L1 6l4 4M19 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Drag
        </span>
      </motion.div>
      <motion.span className="sc__dot" style={{ x, y }} />
    </div>
  );
}
