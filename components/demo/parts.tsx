"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Tiny presenter-tool controls for the Demo Panel. Styled like a parcel label / customs form:
 * typewriter captions, hairline ink boxes, nothing that competes with the product.
 * Touch targets are 44px on coarse pointers and a compact 36px with a mouse.
 */

export function PanelSection({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-dashed border-paper-edge px-4 py-3", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="postal-label text-ink-faded">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const control =
  "inline-flex items-center justify-center gap-1.5 rounded-soft border text-sm leading-tight transition-colors duration-(--motion-dur-fast) ease-out-soft disabled:opacity-50 min-h-9 pointer-coarse:min-h-11";

export function PanelButton({
  tone = "default",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "danger" | "quiet" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        control,
        "px-3",
        tone === "default" && "border-paper-edge bg-paper text-ink hover:bg-paper-deep",
        tone === "primary" && "border-ink bg-ink text-ink-inverse hover:bg-ink-soft",
        tone === "danger" && "border-danger bg-danger text-ink-inverse hover:opacity-90",
        tone === "quiet" && "border-transparent bg-transparent text-ink-soft underline-offset-2 hover:underline",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PanelLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  // Plain anchor on purpose: the panel's jumps are full page loads, like a real tap.
  return (
    <a href={href} className={cn(control, "border-paper-edge bg-paper px-2.5 text-ink hover:bg-paper-deep", className)}>
      {children}
    </a>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Segmented choice. Uses aria-pressed buttons (each is an independent action, not a form field). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  options: readonly SegOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              control,
              "px-2.5",
              active ? "border-postmark bg-postmark text-ink-inverse" : "border-paper-edge bg-paper text-ink hover:bg-paper-deep",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A customs-form tick box. */
export function Tick({ checked, onChange, children, disabled }: { checked: boolean; onChange: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-soft px-1.5 text-sm text-ink select-none hover:bg-paper-deep/60 min-h-8 pointer-coarse:min-h-11",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-paper border border-ink-soft bg-paper-raised text-ink-inverse peer-checked:border-red-ink peer-checked:bg-red-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
      >
        <svg viewBox="0 0 12 12" className={cn("size-3", !checked && "invisible")} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M2.5 6.5l2.2 2.2 4.8-5" />
        </svg>
      </span>
      {children}
    </label>
  );
}

/** On/off switch (fast mode). */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-soft text-left min-h-9 pointer-coarse:min-h-11"
    >
      <span className="text-sm leading-tight text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-faded">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-pill border transition-colors duration-(--motion-dur-fast)",
          checked ? "border-sage-ink bg-sage-ink" : "border-paper-edge bg-paper-deep",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3.5 rounded-pill bg-paper-raised shadow-flat transition-transform duration-(--motion-dur-fast) ease-out-soft",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
