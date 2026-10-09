"use client";

/**
 * <InkButton> / <InkLink>: a ticket with one clipped corner, the footer's shape (D-078), in the
 * site's colours ("Wish You Were Here", D-060).
 * - primary: brick coral (cream text 5.1:1)
 * - secondary: postcard white with a sepia outline
 * - ink: navy with a coral shadow · paper: postcard white on colour fields
 * - quiet: underlined text with a coral rule, still a 44px target · danger: for removing things
 * Hover lifts it off its hard shadow (mouse only), the label rolls over and the arrow's stem
 * stretches; press lands it. Links carry the arrow by default (`arrow={false}`).
 * `loading` keeps focus (aria-disabled, not disabled) and shows a turning postmark ring.
 */
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { cn } from "@/lib/utils/cn";
import "./ui.css";

export type InkButtonVariant = "primary" | "secondary" | "ink" | "paper" | "quiet" | "danger";
export type InkButtonSize = "sm" | "md" | "lg";

export interface InkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: InkButtonVariant;
  size?: InkButtonSize;
  loading?: boolean;
  /** Icon element rendered before the label. */
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Trailing arrow after the label (default off for buttons, on for links). */
  arrow?: boolean;
  /** Text announced while loading (visually the label stays). Default "Working…". */
  loadingLabel?: string;
}

export function inkClasses(variant: InkButtonVariant = "primary", size: InkButtonSize = "md", fullWidth?: boolean, className?: string) {
  return cn(
    "sd-ink",
    variant !== "primary" && `sd-ink--${variant}`,
    size === "lg" && "sd-ink--lg",
    size === "sm" && "sd-ink--sm",
    fullWidth && "sd-ink--full",
    className,
  );
}

function Spinner() {
  return (
    <svg className="sd-ink__spin" viewBox="0 0 20 20" aria-hidden focusable="false">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2.4" opacity="0.45" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The footer's arrow: on hover the stem stretches and the head steps forward. */
function Arrow() {
  return (
    <svg className="sd-ink__arrow" viewBox="0 0 20 16" aria-hidden focusable="false">
      <path className="sd-ink__stem" d="M1 8h15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path className="sd-ink__head" d="M11.5 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

function Face({ icon, loading, arrow, children }: { icon?: ReactNode; loading?: boolean; arrow?: boolean; children?: ReactNode }) {
  return (
    <span className="sd-ink__face">
      {loading ? <Spinner /> : icon ? <span className="sd-ink__icon">{icon}</span> : null}
      <span className="sd-ink__label">{children}</span>
      {arrow && !loading ? <Arrow /> : null}
    </span>
  );
}

export function InkButton({
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  arrow = false,
  loadingLabel = "Working…",
  children,
  className,
  type = "button",
  onClick,
  ...rest
}: InkButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      {...rest}
      type={type}
      onClick={handleClick}
      className={inkClasses(variant, size, fullWidth, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
    >
      <Face icon={icon} loading={loading} arrow={arrow}>
        {children}
      </Face>
      {loading && (
        <span className="sr-only" role="status">
          {loadingLabel}
        </span>
      )}
    </button>
  );
}

export interface InkLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> {
  href: string;
  variant?: InkButtonVariant;
  size?: InkButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Trailing arrow (default: on, unless the link carries an icon). */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
  /** Page transition (oatly.com): the colour that fills the screen on the way to `href`. */
  transition?: string;
  /** Passed to next/link. */
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

/** Same look as InkButton, for navigation. External (http) links open with rel="noopener". */
export function InkLink({ href, variant = "primary", size = "md", icon, fullWidth, arrow = !icon, transition, className, children, prefetch, replace, scroll, ...rest }: InkLinkProps) {
  const cls = inkClasses(variant, size, fullWidth, className);
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a href={href} className={cls} rel={rest.target === "_blank" ? "noopener noreferrer" : undefined} {...rest}>
        <Face icon={icon} arrow={arrow}>
          {children}
        </Face>
      </a>
    );
  }
  if (transition) {
    return (
      <TransitionLink href={href} color={transition} className={cls} prefetch={prefetch} replace={replace} scroll={scroll} {...rest}>
        <Face icon={icon} arrow={arrow}>
          {children}
        </Face>
      </TransitionLink>
    );
  }
  return (
    <Link href={href} className={cls} prefetch={prefetch} replace={replace} scroll={scroll} {...rest}>
      <Face icon={icon} arrow={arrow}>
        {children}
      </Face>
    </Link>
  );
}
