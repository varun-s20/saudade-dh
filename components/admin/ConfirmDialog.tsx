"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { AdminButton } from "./ui";

/**
 * Modal built on the native <dialog> (focus trap, Esc to close and top-layer stacking for free).
 * Never window.confirm/alert/prompt.
 */
export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Activity hides this route instead of unmounting it: close the dialog when hidden.
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-admin-line bg-admin-surface p-0 text-admin-ink shadow-lifted backdrop:bg-ink/35",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="border-b border-admin-line px-5 pt-4 pb-3">
            <h2 id={titleId} className="display ">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-sm text-admin-ink-soft">
                {description}
              </div>
            )}
          </header>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-admin-line bg-admin-bg/60 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Two-button confirmation. Cancel has focus by default: destructive actions need a deliberate click. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel,
  tone = "danger",
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
}) {
  return (
    <AdminDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      description={description}
      footer={
        <>
          <AdminButton tone="quiet" onClick={onClose} disabled={busy} autoFocus>
            Cancel
          </AdminButton>
          <AdminButton tone={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </AdminButton>
        </>
      }
    >
      {children}
    </AdminDialog>
  );
}
