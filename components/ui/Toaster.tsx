"use client";

/**
 * <Toaster>: renders useToasts() items as small postal slips with a perforated stub that
 * carries a tone mark (sage tick / red warning / postmark heart). Bottom-centred above content
 * (--z-toast), clear of the iOS home indicator. Auto-dismisses after `duration`; the timer
 * pauses while the slip is hovered or focused. Errors are announced assertively (role="alert").
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useToasts, type ToastItem, type ToastTone } from "@/lib/state/toast";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { duration, spring } from "@/lib/tokens";
import { IconCheck, IconClose, IconWarning } from "./icons";
import "./ui.css";

const TONE_VAR: Record<ToastTone, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  neutral: "var(--postmark)",
};

function ToneMark({ tone }: { tone: ToastTone }) {
  return (
    <span className="relative grid size-9 place-items-center" aria-hidden>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full" focusable="false">
        <circle cx="18" cy="18" r="16.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.6 1.8" opacity="0.7" />
      </svg>
      {tone === "success" ? (
        <IconCheck size={18} strokeWidth={2.1} />
      ) : tone === "error" ? (
        <IconWarning size={17} strokeWidth={2} />
      ) : (
        <svg viewBox="0 0 24 24" width="15" height="15" focusable="false">
          <path d="M12 20.5C6.6 17 3.5 13.7 3.5 9.6 3.5 7 5.4 5 7.9 5c1.7 0 3.2 1 4.1 2.5C12.9 6 14.4 5 16.1 5c2.5 0 4.4 2 4.4 4.6 0 4.1-3.1 7.4-8.5 10.9z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

function ToastSlip({ item, reduced }: { item: ToastItem; reduced: boolean }) {
  const dismiss = useToasts((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const t = window.setTimeout(() => dismiss(item.id), Math.max(800, remaining.current));
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - started;
    };
  }, [paused, item.id, dismiss]);

  const tilt = item.id % 2 ? -0.6 : 0.5;

  return (
    <motion.li
      layout={reduced ? false : "position"}
      className="sd-toast"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, rotate: -2.5 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotate: tilt }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      transition={reduced ? { duration: duration.fast } : spring.settle}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role={item.tone === "error" ? "alert" : undefined}
      style={{ ["--tone" as string]: TONE_VAR[item.tone] }}
    >
      <div className="sd-toast__slip">
        <div className="sd-toast__stub">
          <ToneMark tone={item.tone} />
        </div>
        <div className="sd-toast__text">
          <p className="sd-toast__title">{item.title}</p>
          {item.body && <p className="sd-toast__body">{item.body}</p>}
        </div>
        <button type="button" className="sd-toast__close" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">
          <IconClose size={18} />
        </button>
      </div>
    </motion.li>
  );
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  const reduced = useReducedMotionPref();
  return (
    <ol className="sd-toaster" aria-live="polite" aria-relevant="additions text" aria-label="Notifications">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastSlip key={t.id} item={t} reduced={reduced} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
