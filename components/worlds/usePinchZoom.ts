"use client";

/**
 * Pinch-zoom + pan for one image, transform-only (scale, x, y motion values).
 *
 *   two pointers   pinch: the point under your fingers stays under your fingers
 *   one pointer    pan, when zoomed in
 *   double tap     zoom to 2.5× at that point, or back out
 *   wheel          zoom around the cursor (desktop; ctrl+wheel = trackpad pinch)
 *   zoomBy/panBy   for the visible buttons and the keyboard (WCAG 2.5.7: no gesture-only actions)
 *
 * Geometry: the image is laid out at its "fit" size, centred in `areaRef`, with
 * transform-origin at its centre. A screen point p maps to the image's local point
 * l = (p - c - t) / s, so keeping l under the fingers gives t = p - c - s·l.
 * Translation is clamped so a zoomed image never leaves a gap at the area's edges.
 */
import { animate, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

export interface FitSize {
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  mode: "pan" | "pinch";
  s0: number;
  x0: number;
  y0: number;
  /** Pinch midpoint, or the pan's starting pointer position. */
  p0: Point;
  dist0: number;
  downAt: number;
  moved: boolean;
}

const MAX = 4;
const MIN_PINCH = 0.8;
const DOUBLE_TAP_ZOOM = 2.5;
const SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;

export function usePinchZoom({ areaRef, fit, reduced }: { areaRef: RefObject<HTMLElement | null>; fit: FitSize; reduced: boolean }) {
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [zoomed, setZoomed] = useState(false);
  useMotionValueEvent(scale, "change", (v) => setZoomed(v > 1.01));

  const fitRef = useRef(fit);
  const reducedRef = useRef(reduced);
  useLayoutEffect(() => {
    fitRef.current = fit;
    reducedRef.current = reduced;
  });

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; p: Point } | null>(null);
  const runs = useRef<AnimationPlaybackControls[]>([]);

  const stop = useCallback(() => {
    runs.current.forEach((r) => r.stop());
    runs.current = [];
  }, []);

  /** Area box in viewport coordinates (the image's untransformed centre is its centre). */
  const box = useCallback(() => {
    const r = areaRef.current?.getBoundingClientRect();
    return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height } : { cx: 0, cy: 0, w: 0, h: 0 };
  }, [areaRef]);

  const clampT = useCallback(
    (s: number, tx: number, ty: number) => {
      const b = box();
      const f = fitRef.current;
      const mx = Math.max(0, (s * f.w - b.w) / 2);
      const my = Math.max(0, (s * f.h - b.h) / 2);
      return { x: clamp(tx, -mx, mx), y: clamp(ty, -my, my) };
    },
    [box],
  );

  const to = useCallback(
    (s: number, tx: number, ty: number) => {
      stop();
      const t = clampT(s, tx, ty);
      if (reducedRef.current) {
        scale.set(s);
        x.set(t.x);
        y.set(t.y);
        return;
      }
      runs.current = [animate(scale, s, SPRING), animate(x, t.x, SPRING), animate(y, t.y, SPRING)];
    },
    [clampT, scale, stop, x, y],
  );

  /** Zoom to `s` keeping screen point `p` (default: the area's centre) fixed. */
  const zoomAt = useCallback(
    (s: number, p?: Point, instant = false) => {
      const b = box();
      const at = p ?? { x: b.cx, y: b.cy };
      const s0 = scale.get();
      const target = clamp(s, 1, MAX);
      const lx = (at.x - b.cx - x.get()) / s0;
      const ly = (at.y - b.cy - y.get()) / s0;
      const tx = at.x - b.cx - target * lx;
      const ty = at.y - b.cy - target * ly;
      if (instant) {
        stop();
        const t = clampT(target, tx, ty);
        scale.set(target);
        x.set(t.x);
        y.set(t.y);
      } else to(target, tx, ty);
    },
    [box, clampT, scale, stop, to, x, y],
  );

  const zoomBy = useCallback((factor: number) => zoomAt(scale.get() * factor), [scale, zoomAt]);
  const reset = useCallback(() => to(1, 0, 0), [to]);
  const panBy = useCallback((dx: number, dy: number) => to(scale.get(), x.get() + dx, y.get() + dy), [scale, to, x, y]);

  const begin = useCallback(() => {
    const list = [...pointers.current.values()];
    const now = performance.now();
    if (list.length >= 2) {
      gesture.current = { mode: "pinch", s0: scale.get(), x0: x.get(), y0: y.get(), p0: mid(list[0], list[1]), dist0: dist(list[0], list[1]), downAt: now, moved: true };
    } else if (list.length === 1) {
      gesture.current = { mode: "pan", s0: scale.get(), x0: x.get(), y0: y.get(), p0: list[0], dist0: 0, downAt: now, moved: false };
    } else gesture.current = null;
  }, [scale, x, y]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stop();
      const wasPan = gesture.current?.mode === "pan";
      begin();
      // A second finger joining a pan is never a tap.
      if (wasPan && gesture.current) gesture.current.moved = true;
    },
    [begin, stop],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g) return;
      const list = [...pointers.current.values()];
      const b = box();
      if (g.mode === "pinch" && list.length >= 2) {
        const m = mid(list[0], list[1]);
        const s = clamp((g.s0 * dist(list[0], list[1])) / g.dist0, MIN_PINCH, MAX);
        const lx = (g.p0.x - b.cx - g.x0) / g.s0;
        const ly = (g.p0.y - b.cy - g.y0) / g.s0;
        const t = clampT(s, m.x - b.cx - s * lx, m.y - b.cy - s * ly);
        scale.set(s);
        x.set(t.x);
        y.set(t.y);
      } else if (g.mode === "pan" && list.length === 1) {
        const dx = list[0].x - g.p0.x;
        const dy = list[0].y - g.p0.y;
        if (Math.hypot(dx, dy) > 8) g.moved = true;
        if (scale.get() > 1.01) {
          const t = clampT(scale.get(), g.x0 + dx, g.y0 + dy);
          x.set(t.x);
          y.set(t.y);
        }
      }
    },
    [box, clampT, scale, x, y],
  );

  const end = useCallback(
    (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
      if (!pointers.current.has(e.pointerId)) return;
      const g = gesture.current;
      const tap = !cancelled && g?.mode === "pan" && !g.moved && performance.now() - g.downAt < 300;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size > 0) {
        // One finger lifted from a pinch: carry on panning with the other.
        begin();
        if (gesture.current) gesture.current.moved = true;
        return;
      }
      gesture.current = null;

      // Settle: never smaller than fit, never beyond the edges.
      const s = scale.get();
      if (s < 1 || s > MAX) to(clamp(s, 1, MAX), s < 1 ? 0 : x.get(), s < 1 ? 0 : y.get());

      if (tap) {
        const p = { x: e.clientX, y: e.clientY };
        const now = performance.now();
        const last = lastTap.current;
        if (last && now - last.t < 320 && Math.hypot(p.x - last.p.x, p.y - last.p.y) < 36) {
          lastTap.current = null;
          if (scale.get() > 1.05) to(1, 0, 0);
          else zoomAt(DOUBLE_TAP_ZOOM, p);
        } else lastTap.current = { t: now, p };
      }
    },
    [begin, scale, to, x, y, zoomAt],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => end(e, false), [end]);
  const onPointerCancel = useCallback((e: PointerEvent<HTMLElement>) => end(e, true), [end]);

  /** Native, non-passive wheel handler (attach with addEventListener so preventDefault works). */
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(scale.get() * factor, { x: e.clientX, y: e.clientY }, true);
    },
    [scale, zoomAt],
  );

  return {
    scale,
    x,
    y,
    zoomed,
    max: MAX,
    zoomBy,
    reset,
    panBy,
    onWheel,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
