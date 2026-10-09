"use client";

/**
 * <Dock>: the pinned bottom slip on sender screens. It rides above the on-screen keyboard
 * (VisualViewport: the keyboard shrinks the visual viewport, not the layout one, on iOS and
 * current Android Chrome) and clears the home indicator (safe-bottom).
 *
 * <SaveDock>: the explicit Save (S12) on that slip: a live status line + Save, disabled while
 * nothing has changed. No autosave.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { InkButton } from "@/components/ui/InkButton";
import { IconCheck, IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import "./sender.css";

/** Keep `--ss-kb` on the element = how far the keyboard covers the layout viewport's bottom. */
export function useKeyboardInset<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const update = () => {
      // Ignore pinch-zoom: only a keyboard shrinks the viewport at scale 1.
      const inset = vv.scale > 1.01 ? 0 : Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty("--ss-kb", `${Math.round(inset)}px`);
      el.dataset.keyboard = inset > 80 ? "open" : "closed";
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return ref;
}

export function Dock({ children, className, label, narrowOnly }: { children: ReactNode; className?: string; label?: string; narrowOnly?: boolean }) {
  const ref = useKeyboardInset<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("ss-dock", narrowOnly && "ss-dock--narrow")} role="region" aria-label={label}>
      <div className={cn("ss-dock__slip", className)}>{children}</div>
    </div>
  );
}

export type SaveTone = "neutral" | "dirty" | "saved" | "busy" | "error";

export interface SaveDockProps {
  /** Short, human status ("Unsaved changes", "Saved", "Tucking in 2 photos…"). Announced politely. */
  status: ReactNode;
  tone?: SaveTone;
  canSave: boolean;
  saving?: boolean;
  onSave: () => void;
  /** Visible label. Default "Save". */
  label?: string;
  savingLabel?: string;
}

export function SaveDock({ status, tone = "neutral", canSave, saving, onSave, label = "Save", savingLabel = "Saving…" }: SaveDockProps) {
  return (
    <Dock label="Save">
      <p className="ss-dock__status" data-tone={tone} aria-live="polite">
        {tone === "saved" ? <IconCheck size={18} className="shrink-0" /> : tone === "error" ? <IconWarning size={18} className="shrink-0" /> : null}
        <span>{status}</span>
      </p>
      <InkButton onClick={onSave} disabled={!canSave && !saving} loading={saving} loadingLabel={savingLabel} className="shrink-0">
        {label}
      </InkButton>
    </Dock>
  );
}
