"use client";

/**
 * <TransitionLink>: the oatly.com page transition. The clicked card grows to fill the screen in
 * its own colour while the page behind darkens; the next page loads underneath, then the colour
 * folds away upwards. Built on next/link (prefetch, middle-click, new tab and keyboard all keep
 * working); only a plain left click is choreographed. Reduced motion: an ordinary link.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { prefersReducedMotion } from "./reduced";

const EASE = "cubic-bezier(0.7, 0, 0.2, 1)";
let running = false;

function layer(z: number, css: Partial<CSSStyleDeclaration>) {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, { position: "fixed", inset: "0", zIndex: String(z), pointerEvents: "auto" }, css);
  document.body.append(el);
  return el;
}

const settle = (a: Animation) => a.finished.catch(() => undefined);

async function play(from: HTMLElement, href: string, color: string, push: (href: string) => void) {
  running = true;
  const r = from.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const startClip = `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px)`;
  const dim = layer(95, { background: "var(--ink)", opacity: "0" });
  const card = layer(96, { background: color, clipPath: startClip, transformOrigin: "50% 0%" });
  try {
    dim.animate([{ opacity: 0 }, { opacity: 0.5 }], { duration: 420, easing: "ease-out", fill: "forwards" });
    await settle(card.animate([{ clipPath: startClip }, { clipPath: "inset(0px 0px 0px 0px)" }], { duration: 560, easing: EASE, fill: "forwards" }));
    push(href);
    const target = new URL(href, window.location.href).pathname;
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const tick = () => (window.location.pathname === target || performance.now() - t0 > 3000 ? done() : requestAnimationFrame(tick));
      tick();
    });
    await new Promise((done) => setTimeout(done, 160));
    dim.remove();
    await settle(card.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 520, easing: EASE, fill: "forwards" }));
  } finally {
    dim.remove();
    card.remove();
    running = false;
  }
}

export interface TransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  /** The colour that fills the screen (any CSS colour, usually a token). */
  color?: string;
  children: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

export function TransitionLink({ href, color = "var(--accent-cobalt)", onClick, children, prefetch, replace, scroll, ...rest }: TransitionLinkProps) {
  const router = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (running || prefersReducedMotion()) return;
    e.preventDefault();
    void play(e.currentTarget, href, color, (h) => (replace ? router.replace(h, { scroll }) : router.push(h, { scroll })));
  };
  return (
    <Link href={href} onClick={handle} prefetch={prefetch} replace={replace} scroll={scroll} {...rest}>
      {children}
    </Link>
  );
}
