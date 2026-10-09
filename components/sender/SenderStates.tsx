"use client";

/**
 * Loading / invalid link / network states shared by every sender screen, plus <EnvelopeGate>,
 * which renders the right one for a `useSenderEnvelope` query and the screen once data is in.
 */
import type { ReactNode } from "react";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { PaperLoader } from "@/components/ui/PaperLoader";
import { Postmark } from "@/components/paper/Postmark";
import { IconRefresh } from "@/components/ui/icons";
import type { QueryState } from "@/lib/hooks/useServiceQuery";
import type { SenderEnvelope } from "@/lib/services/types";

export function SenderLoading({ label = "Opening your envelope…" }: { label?: string }) {
  return (
    <div className="grid min-h-[55dvh] place-items-center">
      <PaperLoader label={label} />
    </div>
  );
}

/** Unknown / revoked token: gentle, with the way back (recover by email, or claim again). */
export function SenderNotFound() {
  return (
    <div className="pt-8">
      <Postmark variant="circle" size={84} rotate={-10} place="SAUDADE · RETURN TO SENDER" className="mb-4" />
      <h1 className="font-display text-3xl leading-tight text-ink">We couldn&apos;t find this envelope</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        The link may be missing a few characters, or it was replaced after a code reset. We can email your private link to you again.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <InkLink href="/recover" fullWidth>
          Email me my link
        </InkLink>
        <InkLink href="/claim" variant="quiet" fullWidth>
          I have my code
        </InkLink>
      </div>
    </div>
  );
}

export function SenderNetworkError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="pt-10" role="alert">
      <h1 className="font-display text-3xl leading-tight text-ink">We couldn&apos;t reach Saudade</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">{message ?? "Check your connection, then try again. Your envelope is safe."}</p>
      <InkButton className="mt-8" onClick={onRetry} icon={<IconRefresh size={18} />}>
        Try again
      </InkButton>
    </div>
  );
}

/**
 * Renders loading / not found / error for the envelope query, or `children(envelope)`.
 * `reload` comes from useServiceQuery.
 */
export function EnvelopeGate({
  query,
  reload,
  children,
  loadingLabel,
}: {
  query: QueryState<SenderEnvelope>;
  reload: () => void;
  children: (envelope: SenderEnvelope) => ReactNode;
  loadingLabel?: string;
}) {
  if (query.status === "loading") return <SenderLoading label={loadingLabel} />;
  if (query.status === "error") {
    if (query.error.code === "not_found" || query.error.code === "unauthorized") return <SenderNotFound />;
    return <SenderNetworkError onRetry={reload} />;
  }
  return <>{children(query.data)}</>;
}
