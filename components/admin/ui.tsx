"use client";

/**
 * Admin kit basics. The admin is deliberately calmer and more utilitarian than the public
 * pages (CLIENT_GUIDE §6.6): paper-toned surfaces, hairline rules, clean type. Still on-brand.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { toast } from "@/lib/state/toast";
import { cn } from "@/lib/utils/cn";

// ─── Buttons ────────────────────────────────────────────────────────────────

export type AdminButtonTone = "primary" | "secondary" | "quiet" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-soft px-4 text-sm font-semibold transition-[background-color,color,scale] duration-(--dur-press) ease-out-strong active:scale-[0.97] disabled:opacity-55 pointer-fine:md:min-h-10";

const BUTTON_TONES: Record<AdminButtonTone, string> = {
  primary: "bg-navy text-ink-inverse hover:bg-ink",
  secondary: "border-2 border-admin-ink bg-admin-surface text-admin-ink hover:bg-paper-deep",
  quiet: "text-admin-ink-soft hover:bg-admin-line/50 hover:text-admin-ink",
  danger: "bg-danger text-ink-inverse hover:bg-red-ink",
};

export function AdminButton({
  tone = "secondary",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: AdminButtonTone; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BUTTON_BASE, BUTTON_TONES[tone], className)}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function AdminLinkButton({ href, tone = "secondary", className, children }: { href: string; tone?: AdminButtonTone; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(BUTTON_BASE, BUTTON_TONES[tone], className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("size-4 animate-spin", className)} aria-hidden fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("overflow-hidden rounded-card border-2 border-admin-ink bg-admin-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b-2 border-admin-line px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="display  text-admin-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-admin-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {/* bodyClassName replaces the default padding (no class merging in this project). */}
      <div className={bodyClassName ?? "px-4 py-4 md:px-5"}>{children}</div>
    </Tag>
  );
}

/** Page title row used by every console page. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="postal-label mb-1 text-admin-ink-soft">{eyebrow}</div>}
        <h1 className="display  text-admin-ink">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-admin-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A plain definition row: label on the left (or above on phones), value on the right. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3", className)}>
      <dt className="text-xs font-medium tracking-wide text-admin-ink-soft uppercase sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere] text-admin-ink">{children}</dd>
    </div>
  );
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

export function AdminInput({
  label,
  hint,
  error,
  id,
  className,
  inputClassName,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null; inputClassName?: string; ref?: Ref<HTMLInputElement> }) {
  const inputId = id ?? `in-${rest.name ?? label.toLowerCase().replace(/\W+/g, "-")}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-err` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-admin-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        {...rest}
        className={cn(
          "min-h-11 w-full rounded-soft border-2 bg-admin-surface px-3 text-base text-admin-ink placeholder:text-ink-faded/70 pointer-fine:md:min-h-10 md:text-sm",
          error ? "border-danger" : "border-admin-ink/30 hover:border-admin-ink/60",
          inputClassName,
        )}
      />
      {hint && (
        <p id={hintId} className="text-xs text-admin-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Search field with a magnifier, used on the dashboard and units table. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Code, email, slug or unit no.",
  label = "Search units",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <label className="sr-only" htmlFor="admin-search">
        {label}
      </label>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-ink-soft" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" strokeLinecap="round" />
      </svg>
      <input
        id="admin-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-soft border-2 border-admin-ink/30 bg-admin-surface pr-3 pl-9 text-base text-admin-ink placeholder:text-ink-faded/70 hover:border-admin-ink/60 pointer-fine:md:min-h-10 md:text-sm"
      />
    </div>
  );
}

// ─── Copy ───────────────────────────────────────────────────────────────────

/** Copy text to the clipboard with a short "Copied" confirmation. */
export function CopyButton({ text, label = "Copy", className, tone = "secondary" }: { text: string; label?: string; className?: string; tone?: AdminButtonTone }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <AdminButton
      tone={tone}
      className={cn("min-h-9 px-3 pointer-fine:md:min-h-8", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        } catch {
          toast("Couldn't copy", { tone: "error", body: "Select the text and copy it by hand." });
        }
      }}
      aria-label={copied ? "Copied" : `${label}: ${text}`}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </AdminButton>
  );
}

// ─── Loading ────────────────────────────────────────────────────────────────

/** Loading placeholder. A span (block by default) so it is valid inside text elements too. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn(!className?.includes("inline") && "block", "animate-pulse rounded-soft bg-admin-line/70", className)} />;
}

/** Inline error panel with a retry, for failed loads. Plain, clear words. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-soft border-2 border-danger bg-admin-surface px-4 py-3 text-sm text-admin-ink">
      <p>{message}</p>
      {onRetry && (
        <AdminButton tone="secondary" onClick={onRetry}>
          Try again
        </AdminButton>
      )}
    </div>
  );
}
