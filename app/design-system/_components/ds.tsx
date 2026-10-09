/**
 * Presentational building blocks for the living style guide (specimen-book layout).
 * No hooks: usable from server and client components.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import "./ds.css";

export function Section({
  id,
  no,
  title,
  lede,
  children,
  className,
}: {
  id: string;
  no: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-4 pt-8 pb-14", className)}>
      <div className="ds-perf mb-8" aria-hidden />
      <header className="mb-8 grid gap-2 md:grid-cols-[10rem_1fr] md:gap-8">
        <p className="postal-label pt-2 text-terracotta-ink">No. {no}</p>
        <div>
          <h2 id={`${id}-title`} className="font-display text-[2rem] leading-[1.1] tracking-[-0.01em] text-ink md:text-[2.5rem]">
            {title}
          </h2>
          {lede && <p className="mt-3 max-w-[40rem] text-[0.9375rem] leading-relaxed text-ink-soft">{lede}</p>}
        </div>
      </header>
      <div className="md:pl-[12rem]">{children}</div>
    </section>
  );
}

export function SubHead({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-10 mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 first:mt-0">
      <h3 className="font-display text-[1.25rem] leading-tight text-ink">{children}</h3>
      {note && <p className="text-[0.8125rem] text-ink-faded">{note}</p>}
    </div>
  );
}

/** A specimen with crop marks and a typed caption. */
export function Cell({
  label,
  note,
  children,
  className,
  bodyClassName,
}: {
  label: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <figure className={cn("m-0 flex min-w-0 flex-col gap-3", className)}>
      <div className={cn("ds-cell flex min-h-[9rem] items-center justify-center p-5", bodyClassName)}>{children}</div>
      <figcaption className="px-1">
        <span className="postal-label block text-ink-soft">{label}</span>
        {note && <span className="mt-1 block text-[0.8125rem] leading-snug text-ink-faded">{note}</span>}
      </figcaption>
    </figure>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</div>;
}

/** Monospace token name chip. */
export function Tok({ children }: { children: ReactNode }) {
  return <code className="rounded-paper bg-paper-deep/70 px-1.5 py-0.5 font-postal text-[0.75rem] text-ink-soft">{children}</code>;
}
