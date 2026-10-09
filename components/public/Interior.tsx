/**
 * The interior public pages (claim, recover, help, the fine print) in "Wish You Were Here"
 * (DECISIONS D-061): a linen-postcard masthead with a perforated bottom edge, and the page's work
 * done on the BACK of a postcard (the message side on the left, stamp box and address lines on
 * the right). Motion (Emil Kowalski): the title is inked on by a roller and its script word is
 * written after it, once, on load; the postcard is posted up out of the masthead. Each page
 * brings one small piece of art with its own loop or landing. Reduced motion: all still.
 */
import type { CSSProperties, ReactNode } from "react";
import { Stamp } from "@/components/stamps/Stamp";
import type { StampKind } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import "./interior.css";

type Tone = "sky" | "sunset" | "sea";
const TONE: Record<Tone, string> = { sky: "band-sky ix-head--sky", sunset: "band-sunset ix-head--sunset", sea: "band-sea ix-head--sea" };

export function PageMasthead({
  tone = "sky",
  eyebrow,
  title,
  titleId,
  lede,
  art,
  children,
  className,
}: {
  tone?: Tone;
  eyebrow: ReactNode;
  title: ReactNode;
  titleId?: string;
  lede?: ReactNode;
  /** Decorative art beside the title (hidden from assistive tech: the words carry the meaning). */
  art?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("ix-head", TONE[tone], className)}>
      <span aria-hidden className="ix-head__sun" />
      <div className="wrap ix-head__inner">
        <div className="ix-head__copy">
          <p className="tag ix-head__tag">{eyebrow}</p>
          <h1 id={titleId} className="display ix-head__title">
            {title}
          </h1>
          {lede && <p className="ix-head__lede">{lede}</p>}
          {children}
        </div>
        {art && (
          <div aria-hidden className="ix-head__art">
            {art}
          </div>
        )}
      </div>
    </header>
  );
}

/** The back of a postcard: "POST CARD" across the top, message left, stamp and address right. */
export function PostcardSheet({
  children,
  side,
  label = "Post card",
  className,
  ...aria
}: {
  children: ReactNode;
  side?: ReactNode;
  label?: string;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <section className={cn("ix-sheet", className)} {...aria}>
      <p aria-hidden className="ix-sheet__head">
        {label}
      </p>
      <div className={cn("ix-sheet__body", !side && "ix-sheet__body--solo")}>
        <div className="ix-sheet__msg">{children}</div>
        {side && <div className="ix-sheet__side">{side}</div>}
      </div>
    </section>
  );
}

/** The dashed "place stamp here" box in the corner of a postcard back. */
export function StampBox({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("ix-stampbox", className)}>
      {children ?? <span className="ix-stampbox__hint">Place stamp here</span>}
    </div>
  );
}

/** Address lines: a typewritten label over each ruled line. */
export function AddressLines({ items, className }: { items: readonly (readonly [ReactNode, ReactNode])[]; className?: string }) {
  return (
    <dl className={cn("ix-addr", className)}>
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A hand of stamps fanned out (masthead art). Lands one by one; spreads when a mouse comes near. */
export function StampFan({ kinds }: { kinds: readonly StampKind[] }) {
  const mid = (kinds.length - 1) / 2;
  return (
    <div className="ix-fan">
      {kinds.map((k, i) => (
        <span key={k} className="ix-fan__card" style={{ "--i": i, "--o": i - mid } as CSSProperties}>
          <Stamp kind={k} width={118} rotate={0} />
        </span>
      ))}
    </div>
  );
}
