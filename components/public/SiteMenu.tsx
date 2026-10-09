"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { IconClose } from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
}

/**
 * Mobile / tablet site menu (below lg): a square toggle in the header that drops a full-width
 * panel of big links. Escape or any link closes it; focus returns to the toggle.
 */
export function SiteMenu({ items }: { items: readonly NavItem[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="press grid size-11 shrink-0 place-items-center rounded-pill text-current transition-colors hover:bg-paper-deep/60 lg:hidden"
      >
        <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
        {open ? (
          <IconClose size={24} />
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
            <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
          </svg>
        )}
      </button>
      <nav
        id={id}
        aria-label="Menu"
        hidden={!open}
        className="pub-menu absolute inset-x-0 top-full border-b-[1.5px] border-paper-shadow bg-paper-raised shadow-lifted lg:hidden"
      >
        <ul className="wrap divide-y divide-paper-shadow py-2">
          {items.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className="display flex items-center justify-between py-4 text-[1.35rem] text-ink"
              >
                {n.label}
                <span aria-hidden className="text-red">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
