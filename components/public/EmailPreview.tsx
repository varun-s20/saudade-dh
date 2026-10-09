"use client";

import type { ReactNode } from "react";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { Postmark } from "@/components/paper/Postmark";
import { site } from "@/config/site";
import type { EmailMessage, EmailTemplate } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { dateTime } from "@/lib/utils/format";

/** A sent message, or a draft (no id / sentAt yet) for "preview before sending". */
export type EmailLike = Pick<EmailMessage, "template" | "to" | "subject" | "text" | "link" | "code"> & {
  sentAt?: string;
};

export interface EmailPreviewProps {
  message: EmailLike;
  /**
   * When true the link and the call-to-action are real anchors (the presenter can open the
   * magic link from the demo outbox). When false they render as text (admin "preview before send").
   */
  interactive?: boolean;
  /** Small caption above the sheet, e.g. "Preview · not sent yet". */
  status?: string;
  className?: string;
}

const CTA: Record<EmailTemplate, string> = {
  sender_link: "Open your envelope",
  recover_link: "Open your envelope",
  gift_code: "Enter your code",
};

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Turn URLs into links and highlight the activation code inside a line of plain text. */
function renderInline(line: string, message: EmailLike, interactive: boolean, keyBase: string): ReactNode[] {
  return line.split(URL_RE).flatMap((part, i) => {
    const key = `${keyBase}-${i}`;
    if (/^https?:\/\//.test(part)) {
      return interactive ? (
        <a key={key} href={part} className="break-all text-postmark underline decoration-postmark-faded underline-offset-2 hover:decoration-postmark">
          {part}
        </a>
      ) : (
        <span key={key} className="break-all text-postmark underline decoration-postmark-faded underline-offset-2">
          {part}
        </span>
      );
    }
    if (message.code && part.includes(message.code)) {
      return part.split(message.code).flatMap((chunk, j, arr) =>
        j < arr.length - 1
          ? [chunk, <strong key={`${key}-c${j}`} className="font-postal tracking-wider text-ink">{message.code}</strong>]
          : [chunk],
      );
    }
    return [part];
  });
}

/**
 * Renders an EmailMessage as a letter on paper (shared by the admin "Email code" preview and the
 * Demo Panel outbox). The real emails will be plain and short; this shows their words and link.
 */
export function EmailPreview({ message, interactive = true, status, className }: EmailPreviewProps) {
  const paragraphs = message.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const sent = message.sentAt;

  return (
    <figure className={cn("relative", className)} aria-label={`Email: ${message.subject}`}>
      {status && <figcaption className="postal-label mb-2 text-ink-faded">{status}</figcaption>}
      <PaperSheet edge="deckled" className="relative overflow-hidden rounded-paper px-5 pt-5 pb-6 text-ink">
        {/* Envelope-style header */}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 pr-16 text-sm">
          <dt className="postal-label pt-0.5 text-ink-faded">From</dt>
          <dd className="min-w-0 truncate">
            {site.name} <span className="text-ink-faded">&lt;{site.supportEmail}&gt;</span>
          </dd>
          <dt className="postal-label pt-0.5 text-ink-faded">To</dt>
          <dd className="min-w-0 truncate">{message.to || <span className="text-ink-faded">(no address yet)</span>}</dd>
          {sent && (
            <>
              <dt className="postal-label pt-0.5 text-ink-faded">Sent</dt>
              <dd>{dateTime(sent)}</dd>
            </>
          )}
        </dl>
        <Postmark
          className="pointer-events-none absolute top-3 right-3 opacity-80"
          size={64}
          rotate={-12}
          place="SAUDADE · POST"
          date={sent}
          variant="circle"
        />

        <div className="my-4 border-t border-dashed border-paper-edge" aria-hidden />

        <p className="font-display text-lg leading-snug text-ink">{message.subject}</p>

        <div className="mt-3 space-y-3 text-base leading-relaxed text-ink-soft">
          {paragraphs.map((p, i) => (
            <p key={i}>
              {p.split("\n").map((line, j, lines) => (
                <span key={j}>
                  {renderInline(line, message, interactive, `${i}-${j}`)}
                  {j < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </div>

        {message.template === "gift_code" && message.code && (
          <div className="mt-5 flex flex-col items-center gap-1 rounded-soft border border-dashed border-paper-edge bg-paper px-4 py-3">
            <span className="postal-label text-ink-faded">Your code</span>
            <span className="font-postal text-2xl tracking-[0.18em] text-ink">{message.code}</span>
          </div>
        )}

        {message.link &&
          (interactive ? (
            <a
              href={message.link}
              className="tap-target mt-5 inline-flex items-center justify-center rounded-pill bg-ink px-5 text-sm font-medium text-ink-inverse shadow-stamp transition-transform duration-(--motion-dur-fast) ease-paper hover:-translate-y-px"
            >
              {CTA[message.template]}
            </a>
          ) : (
            <span className="tap-target mt-5 inline-flex items-center justify-center rounded-pill bg-ink/85 px-5 text-sm font-medium text-ink-inverse">
              {CTA[message.template]}
            </span>
          ))}

        <p className="mt-5 text-xs text-ink-faded">
          Sent by {site.name}. Questions? Write to {site.supportEmail}.
        </p>
      </PaperSheet>
    </figure>
  );
}
