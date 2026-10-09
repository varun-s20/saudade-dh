"use client";

/**
 * <PhotoViewer>: one photo, full screen, to look at closely. Pinch or double-tap to zoom, drag to
 * pan when zoomed; visible zoom buttons and the keyboard do the same (+ / - / 0, arrows, Esc).
 * Rendered in a portal above the photo world (z-modal), so it is truly full screen on desktop too.
 * Zoom resets on close (the viewer unmounts).
 *
 * A11y: role="dialog" + aria-modal, focus starts on Close and returns to the photo that opened
 * it, Tab stays inside. Key events stop here: React bubbles portal events to the stamp world's
 * <Sheet>, which would otherwise close too on Escape.
 */
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { useElementSize } from "@/components/envelope/useElementSize";
import { IconClose, IconPlus, IconRefresh } from "@/components/ui/icons";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { ease } from "@/lib/tokens";
import { usePinchZoom } from "./usePinchZoom";
import "./worlds.css";

export interface PhotoViewerProps {
  src: string;
  alt: string;
  caption?: string;
  /** Intrinsic size (aspect ratio). */
  width: number;
  height: number;
  /** "Photo 3 of 6" */
  position: string;
  onClose: () => void;
}

export function PhotoViewer({ src, alt, caption, width, height, position, onClose }: PhotoViewerProps) {
  const reduced = useReducedMotionPref();
  const dialogRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const area = useElementSize(areaRef);

  const aspect = width > 0 && height > 0 ? width / height : 1;
  const fitScale = Math.min(area.width / aspect, area.height);
  const fit = area.width > 0 ? { w: Math.round(fitScale * aspect), h: Math.round(fitScale) } : { w: 0, h: 0 };
  const zoom = usePinchZoom({ areaRef, fit, reduced });

  // Focus in on open; back to the photo that opened it on close.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Non-passive listeners: wheel zoom (and trackpad pinch) without zooming the page, and no
  // Safari page-pinch while the photo is being pinched.
  const onWheel = zoom.onWheel;
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", stopGesture, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", stopGesture);
    };
  }, [onWheel]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const step = 72;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        return;
      case "+":
      case "=":
        e.preventDefault();
        zoom.zoomBy(1.6);
        return;
      case "-":
      case "_":
        e.preventDefault();
        zoom.zoomBy(1 / 1.6);
        return;
      case "0":
        e.preventDefault();
        zoom.reset();
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
        if (!zoom.zoomed) return;
        e.preventDefault();
        zoom.panBy(e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0, e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0);
        return;
      case "Tab": {
        const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
        if (nodes.length === 0) return;
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next = e.shiftKey ? (i <= 0 ? nodes.length - 1 : i - 1) : i === nodes.length - 1 ? 0 : i + 1;
        nodes[next].focus();
        return;
      }
    }
  };

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${position}, full screen`}
      tabIndex={-1}
      className="wd-viewer fixed inset-0 select-none outline-none"
      style={{ zIndex: "var(--z-modal)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.22, ease: ease.out }}
      onKeyDown={onKeyDown}
      data-photo-viewer
    >
      {/* The gesture surface is the whole screen; the photo sits centred in the area between the bars.
          Touching it keeps keyboard focus inside the dialog (Esc, +, -, 0 keep working). */}
      <div
        className="absolute inset-0 touch-none"
        {...zoom.handlers}
        onPointerDown={(e) => {
          if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus({ preventScroll: true });
          zoom.handlers.onPointerDown(e);
        }}
      >
        <div ref={areaRef} className="wd-viewer__area absolute grid place-items-center">
          <motion.div
            initial={reduced ? false : { scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.32, ease: ease.out }}
            style={{ width: fit.w, height: fit.h, opacity: fit.w ? 1 : 0 }}
          >
            <motion.img
              src={src}
              alt={alt}
              width={fit.w || undefined}
              height={fit.h || undefined}
              draggable={false}
              decoding="async"
              className="wd-viewer__img block h-full w-full max-w-none"
              style={{ x: zoom.x, y: zoom.y, scale: zoom.scale }}
            />
          </motion.div>
        </div>
      </div>

      <div className="wd-viewer__bar wd-viewer__bar--top pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-3">
        <p className="postal-label px-2 text-ink-inverse/80">{position}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close the photo"
          className="wd-viewer__btn pointer-events-auto tap-target inline-flex items-center justify-center rounded-pill"
          data-viewer-close
        >
          <IconClose size={22} />
        </button>
      </div>

      <div className="wd-viewer__bar wd-viewer__bar--bottom pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4">
        {caption ? <p className="wd-viewer__caption max-w-[30rem] text-center font-hand text-ink-inverse">{caption}</p> : null}
        <div className="pointer-events-auto flex items-center gap-2" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => zoom.zoomBy(1 / 1.6)}
            disabled={!zoom.zoomed}
            aria-label="Zoom out"
            className="wd-viewer__btn tap-target inline-flex items-center justify-center rounded-pill"
          >
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M5.1 12.1h13.8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => zoom.reset()}
            disabled={!zoom.zoomed}
            aria-label="Fit the whole photo"
            className="wd-viewer__btn tap-target inline-flex items-center justify-center rounded-pill"
          >
            <IconRefresh size={20} />
          </button>
          <button
            type="button"
            onClick={() => zoom.zoomBy(1.6)}
            aria-label="Zoom in"
            className="wd-viewer__btn tap-target inline-flex items-center justify-center rounded-pill"
            data-viewer-zoom-in
          >
            <IconPlus size={22} />
          </button>
        </div>
        <p className="text-xs text-ink-inverse/70">Pinch or double-tap to look closer.</p>
      </div>
    </motion.div>
  );
}
