"use client";

/**
 * The public header. At the top of the page it is transparent and sits over the page's sky,
 * sunset or sea; once the page scrolls it becomes the linen bar (a colour change, so a plain
 * `ease` transition). `tone="light"` switches its text to cream while it floats over a dark band.
 */
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};
const scrolled = () => window.scrollY > 8;
const atTop = () => false;

export function PubHead({ tone = "dark", children }: { tone?: "dark" | "light"; children: ReactNode }) {
  const isScrolled = useSyncExternalStore(subscribe, scrolled, atTop);
  return (
    <header className="pub-head" data-tone={tone} data-scrolled={isScrolled || undefined}>
      {children}
    </header>
  );
}
