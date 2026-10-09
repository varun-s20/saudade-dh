"use client";

/**
 * <SenderConfirm>: an on-brand confirm slip (never window.confirm). Built on the native <dialog>
 * for the focus trap, Esc and top-layer stacking. Focus lands on the safe choice (cancel) and
 * returns to whatever had it before. Activity: closed in a layout-effect cleanup, so a hidden
 * route never leaves a modal open.
 */
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { InkButton } from "@/components/ui/InkButton";
import "./sender.css";

export interface SenderConfirmProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Confirm is destructive (brick-red ink). */
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
}

export function SenderConfirm({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, danger, busy, busyLabel }: SenderConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) {
      d.close();
      const back = returnTo.current;
      returnTo.current = null;
      if (back?.isConnected) back.focus();
    }
  }, [open]);

  // Activity hides this route instead of unmounting it: never leave the modal open.
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="ss-confirm"
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={(e) => {
        // Esc = the safe choice. Keep React in charge of open/closed.
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      {open && (
        <div className="ss-confirm__slip">
          <h2 id={titleId} className="font-display text-2xl leading-tight text-ink">
            {title}
          </h2>
          {children && (
            <div id={bodyId} className="mt-2 leading-relaxed text-ink-soft">
              {children}
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <InkButton variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
              {cancelLabel}
            </InkButton>
            <InkButton variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy} loadingLabel={busyLabel}>
              {confirmLabel}
            </InkButton>
          </div>
        </div>
      )}
    </dialog>
  );
}
