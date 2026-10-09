"use client";

/**
 * <PostcardRack>: a souvenir-shop spinner rack. Postcards stand round a pole; it turns to the next
 * card on its own every few seconds, and you can drag it, flick it, or use the arrows / arrow
 * keys, and it spins and settles on the nearest card.
 * Motion & gesture (Emil Kowalski):
 * - the drag follows the pointer 1:1 (pointer capture, so it keeps following off the element);
 *   extra fingers are ignored once a drag has started;
 * - on release the flick's velocity is projected forward, then a spring settles on a card:
 *   springs keep their velocity, so the hand-off from drag to settle has no seam;
 * - the active card's details crossfade with a little blur (two states read as one change).
 * Turning on its own (every AUTO_MS): only while it is on screen and the tab is visible; it
 * waits while a pointer rests on the rack, while it has keyboard focus, and while it is dragged,
 * and the pause button stops it (WCAG 2.2.2). The timer restarts after every turn, so a manual
 * turn is never followed straight away by an automatic one. While it turns on its own the
 * details are not announced (aria-live off), so screen readers aren't interrupted.
 * Reduced motion: no turning on its own, no momentum; it simply steps to the next card.
 */
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { cn } from "@/lib/utils/cn";
import "./motion.css";

const SENS = 0.32; // degrees per pixel dragged
const AUTO_MS = 3000; // a turn every three seconds
const SPRING = { type: "spring", stiffness: 150, damping: 22, mass: 1 } as const;

export interface RackItem {
  key: string;
  card: ReactNode;
  detail: ReactNode;
  name: string;
}

export function PostcardRack({ items, label, className }: { items: RackItem[]; label: string; className?: string }) {
  const n = items.length;
  // A real rack is stocked with copies: with few designs, every card appears twice so the
  // neighbours stand at an angle either side of the front card.
  const slots = n < 6 ? [...items, ...items] : items;
  const step = 360 / slots.length;
  const reduced = useReducedMotionPref();
  const rot = useMotionValue(0);
  const ring = useTransform(rot, (r) => `translateZ(calc(var(--rack-r) * -1)) rotateY(${r}deg)`);
  const [active, setActive] = useState(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ id: number; x: number; r: number; lastX: number; lastT: number; v: number; moved: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // What lets it turn on its own
  const [paused, setPaused] = useState(false); // the pause button
  const [dragging, setDragging] = useState(false);
  const [resting, setResting] = useState(false); // a pointer rests on the rack
  const [focused, setFocused] = useState(false); // keyboard focus inside (not a mouse click)
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const auto = !reduced && !paused;
  const turning = auto && !dragging && !resting && !focused && onScreen && tabVisible;

  useMotionValueEvent(rot, "change", (v) => {
    const i = ((Math.round(-v / step) % n) + n) % n;
    setActive((a) => (a === i ? a : i));
  });

  const settle = (target: number) => {
    anim.current?.stop();
    if (reduced) {
      rot.set(target);
      return;
    }
    anim.current = animate(rot, target, SPRING);
  };
  const nearest = (v: number) => Math.round(v / step) * step;
  const go = (dir: 1 | -1) => settle(nearest(rot.get()) - dir * step);

  // On screen, and the tab visible
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // The next turn, AUTO_MS after the last one (whoever turned it)
  useEffect(() => {
    if (!turning) return;
    const t = window.setTimeout(() => {
      anim.current?.stop();
      anim.current = animate(rot, Math.round(rot.get() / step) * step - step, SPRING);
    }, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [turning, active, step, rot]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) return; // multi-touch: ignore extra fingers once a drag has begun
    if (e.pointerType === "mouse" && e.button !== 0) return;
    anim.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, r: rot.get(), lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    rot.set(d.r + dx * SENS);
    const dt = now - d.lastT;
    if (dt > 0) d.v = d.v * 0.2 + ((e.clientX - d.lastX) / dt) * 0.8;
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    // A quick flick should be enough: project the release velocity forward, then settle.
    const projected = reduced ? rot.get() : rot.get() + d.v * SENS * 260;
    settle(nearest(projected));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={root}
      className={cn("rk", className)}
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="rk__stage">
        <div className="rk__sign" aria-hidden>
          Postcards · {n} stamps
        </div>
        <div
          className="rk__viewport"
          role="group"
          aria-roledescription="carousel"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={(e) => e.pointerType === "mouse" && setResting(true)}
          onPointerLeave={() => setResting(false)}
        >
          <motion.div className="rk__ring" style={{ transform: ring }}>
            {slots.map((it, i) => (
              <div key={`${it.key}-${i}`} className="rk__card" aria-hidden style={{ transform: `rotateY(${i * step}deg) translateZ(var(--rack-r))` }}>
                {it.card}
              </div>
            ))}
          </motion.div>
          <span className="rk__pole" aria-hidden />
        </div>
        <div className="rk__base" aria-hidden />
        <div className="rk__controls">
          <button type="button" className="rk__btn" onClick={() => go(-1)} aria-label="Previous stamp">
            <svg aria-hidden viewBox="0 0 20 16" width="20" height="16">
              <path d="M19 8H3.5M8.5 2l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
          {reduced ? null : (
            <button
              type="button"
              className="rk__btn rk__btn--play"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Turn the rack on its own" : "Stop the rack turning on its own"}
              data-paused={paused || undefined}
            >
              {paused ? (
                <svg aria-hidden viewBox="0 0 16 16" width="16" height="16">
                  <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
                </svg>
              ) : (
                <svg aria-hidden viewBox="0 0 16 16" width="16" height="16">
                  <path d="M4 2.5h3v11H4zM9.5 2.5h3v11h-3z" fill="currentColor" />
                </svg>
              )}
            </button>
          )}
          <button type="button" className="rk__btn" onClick={() => go(1)} aria-label="Next stamp">
            <svg aria-hidden viewBox="0 0 20 16" width="20" height="16">
              <path d="M1 8h15.5M11.5 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        <span className="rk__hint">Drag to spin</span>
      </div>
      <div className="rk__detail" aria-live={turning ? "off" : "polite"}>
        <div key={items[active].key} className="rk__detail-in">
          {items[active].detail}
        </div>
      </div>
    </div>
  );
}
