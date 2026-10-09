"use client";

/**
 * Plain, kind notices on the desk: S19 "not found", the network retry, and the preview's invalid
 * link. Error copy is plain (README rule 11); only the decoration is postal.
 */
import type { ReactNode } from "react";
import { site } from "@/config/site";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { Postmark } from "@/components/paper/Postmark";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconRefresh } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import "./recipient.css";

export function RecipientNotice({
  title,
  children,
  actions,
  mark,
  contained,
  state,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  mark?: ReactNode;
  contained?: boolean;
  state: string;
}) {
  return (
    <section
      aria-labelledby={`notice-${state}`}
      className={cn("rc-desk relative flex w-full items-center justify-center px-4 py-10", contained ? "h-full" : "min-h-svh")}
      data-recipient-state={state}
    >
      <PaperSheet as="div" tone="aged" edge="deckled" seed={41} className="px-6 pt-10 pb-8 text-center sm:px-10" wrapperClassName="w-full max-w-[26rem]">
        {mark ? <div className="mb-6 flex justify-center">{mark}</div> : null}
        <h1 id={`notice-${state}`} className="display text-[1.55rem] leading-[1.05] text-ink text-balance">
          {title}
        </h1>
        <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
        {actions ? <div className="mt-7 flex flex-col items-stretch gap-3">{actions}</div> : null}
      </PaperSheet>
    </section>
  );
}

function SupportLine() {
  return (
    <p className="text-sm text-ink-faded">
      Still not working? Write to{" "}
      <a href={`mailto:${site.supportEmail}`} className="underline underline-offset-2 hover:text-ink">
        {site.supportEmail}
      </a>{" "}
      and we&apos;ll help.
    </p>
  );
}

/** S19: the slug doesn't match any envelope. */
export function EnvelopeNotFound({ contained }: { contained?: boolean }) {
  return (
    <RecipientNotice
      state="not_found"
      contained={contained}
      title="We couldn't find this envelope"
      mark={<Postmark variant="circle" place="SAUDADE" bottom="ADDRESS UNKNOWN" size={104} rotate={-8} opacity={0.75} />}
      actions={
        <>
          <InkLink href="/help/tap" fullWidth>
            How to tap the heart
          </InkLink>
          <SupportLine />
        </>
      }
    >
      <p>This link doesn&apos;t match any Saudade envelope. It may be incomplete, or it may have been copied wrongly.</p>
      <p>If you tapped a ceramic envelope, hold the top of your phone to the heart again.</p>
    </RecipientNotice>
  );
}

/** The envelope couldn't be loaded (offline, server trouble). */
export function RecipientError({ onRetry, contained }: { onRetry: () => void; contained?: boolean }) {
  return (
    <RecipientNotice
      state="error"
      contained={contained}
      title="We couldn't open your envelope"
      actions={
        <>
          <InkButton onClick={onRetry} icon={<IconRefresh size={20} />} fullWidth data-recipient-retry>
            Try again
          </InkButton>
          <SupportLine />
        </>
      }
    >
      <p>The connection may have dropped. Nothing is lost: try again in a moment.</p>
    </RecipientNotice>
  );
}
