"use client";

/**
 * S13 · Sender preview (/s/[token]/preview): exactly what the recipient will see (the same
 * <RecipientExperience>), inside a clearly framed preview.
 *
 *   banner   "Preview — this doesn't count as their first open", Back to your envelope,
 *            First tap / Coming back, Replay reveal (remounts the ceremony)
 *   frame    an airmail border around the recipient's screen
 *
 * Integrity (CLIENT_GUIDE §6.4, R-42): this screen never calls services.reveal.markRevealed and
 * never writes the device's lastVisit; the reveal runs with mode="preview" and no onComplete
 * recording. The unit's reveal state is unchanged afterwards (verifiable in /admin).
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { services } from "@/lib/services";
import type { RecipientEnvelope } from "@/lib/services/types";
import { filledKinds } from "@/lib/recipient-mode";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { useNow } from "@/components/public/useNow";
import { InkLink } from "@/components/ui/InkButton";
import { IconBack, IconRefresh } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { RecipientExperience, type ExperienceMode } from "./RecipientExperience";
import { RecipientLoading } from "./RecipientLoading";
import { RecipientError, RecipientNotice } from "./RecipientNotice";
import { localIsoDate } from "./labels";
import "./recipient.css";

type View = "first_tap" | "repeat";

export function PreviewScreen() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const q = useServiceQuery(() => services.content.getSenderEnvelope(token), [token]);
  const now = useNow();
  const [view, setView] = useState<View | null>(null);
  const [run, setRun] = useState(0);

  if (q.status === "error" && (q.error.code === "not_found" || q.error.code === "unauthorized")) return <PreviewInvalid />;

  const sender = q.status === "success" ? q.data : null;
  const hasContent = sender ? filledKinds(sender.contents).length > 0 : false;
  const revealed = Boolean(sender?.unit.revealedAt);
  const sealed = Boolean(sender?.unit.sealedAt);
  const current: View = view ?? (revealed ? "repeat" : "first_tap");
  const mode: ExperienceMode = hasContent ? current : "empty";
  const today = now ? localIsoDate(now) : null;

  const replay = () => {
    setView("first_tap");
    setRun((r) => r + 1);
  };

  const env: RecipientEnvelope | null = sender
    ? { slug: sender.unit.slug, status: sender.unit.status, sealedAt: sender.unit.sealedAt, revealedAt: sender.unit.revealedAt, contents: sender.contents }
    : null;

  const note = !sender
    ? null
    : !hasContent
      ? null
      : revealed
        ? "They've already opened it. Their taps now open calmly, straight to the envelope."
        : !sealed
          ? "Not sealed yet: until you seal it, their tap shows “still being written”."
          : "Sealed. Their next tap on the ceramic plays this reveal.";

  return (
    <div className="flex h-svh min-h-screen flex-col" data-preview>
      <header className="rc-preview-banner relative shrink-0" style={{ zIndex: "var(--z-header)" }}>
        <div className="mx-auto flex max-w-[72rem] flex-col gap-1.5 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-2.5">
          <div className="min-w-0 text-center sm:order-2 sm:flex-1 sm:text-left">
            <h1 className="sr-only">Preview of what they&apos;ll see</h1>
            <p className="text-[0.8125rem] leading-snug text-ink sm:text-sm" data-preview-statement>
              <strong className="postal-label font-normal text-red-ink">Preview:</strong> this doesn&apos;t count as their first open
            </p>
            {note ? <p className="text-xs leading-snug text-ink-faded">{note}</p> : null}
          </div>

          <div className="flex items-center justify-between gap-1.5 sm:contents">
            <Link
              href={`/s/${token}`}
              aria-label="Back to your envelope"
              className="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-soft px-1 text-sm text-ink-soft hover:text-ink sm:order-1"
              data-preview-back
            >
              <IconBack size={20} />
              <span className="hidden sm:inline">Back to your envelope</span>
            </Link>

            <div className="rc-segmented sm:order-3" role="group" aria-label="Show the envelope as">
              {(
                [
                  ["first_tap", "First tap"],
                  ["repeat", "Coming back"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className="rc-segmented__item"
                  aria-pressed={hasContent && current === v}
                  disabled={!hasContent}
                  onClick={() => {
                    setView(v);
                    setRun((r) => r + 1);
                  }}
                  data-preview-view={v}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={replay}
              disabled={!hasContent}
              aria-label="Replay reveal"
              className="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-paper-edge bg-paper px-3 text-sm text-ink transition-colors hover:bg-paper-deep disabled:opacity-50 sm:order-4 sm:px-3.5"
              data-preview-replay
            >
              <IconRefresh size={18} />
              <span className="sm:hidden">Replay</span>
              <span className="hidden sm:inline">Replay reveal</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="rc-preview-frame rc-airmail relative min-h-0 flex-1">
        <div className="rc-preview-frame__inner" aria-label="Preview of the recipient's screen" role="region">
          {q.status === "loading" ? (
            <RecipientLoading contained label="Opening the preview…" />
          ) : q.status === "error" ? (
            <RecipientError contained onRetry={() => void q.reload()} />
          ) : env ? (
            <RecipientExperience
              key={`${mode}-${run}`}
              env={env}
              mode={mode}
              variant="preview"
              contained
              postmarkDate={env.sealedAt ?? today}
              emptyNote={
                <div className={cn("mt-6 flex flex-col items-center gap-3")}>
                  <p className="text-sm text-paper/80">Preview: this is what they&apos;ll see until you add something and seal the envelope.</p>
                  <InkLink href={`/s/${token}`} variant="secondary">
                    Add something
                  </InkLink>
                </div>
              }
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** The token doesn't match an envelope (mistyped, or replaced by a reset). */
function PreviewInvalid() {
  return (
    <RecipientNotice
      state="invalid_link"
      title="We couldn't find this envelope"
      actions={
        <InkLink href="/recover" fullWidth>
          Get your link again
        </InkLink>
      }
    >
      <p>This preview link doesn&apos;t match an envelope. It may be incomplete, or a newer link may have replaced it.</p>
    </RecipientNotice>
  );
}
