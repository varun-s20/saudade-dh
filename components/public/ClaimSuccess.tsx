"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { StampedInput } from "@/components/forms/StampedInput";
import { Postmark } from "@/components/paper/Postmark";
import { Stamp } from "@/components/stamps/Stamp";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconCheck, IconCopy, IconExternal } from "@/components/ui/icons";
import { PaperLoader } from "@/components/ui/PaperLoader";
import { senderPath, site } from "@/config/site";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import type { SenderEnvelope, ServiceResult } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { AddressLines, PageMasthead, PostcardSheet, StampBox } from "./Interior";

const noop = () => () => {};
/** Client-only values, read without a hydration mismatch ("" / false on the server). */
const useOrigin = () =>
  useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
const useCanShare = () =>
  useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const missing = (): Promise<ServiceResult<SenderEnvelope>> => Promise.resolve({ ok: false, error: { code: "not_found" } });

/** S3: "Your envelope is yours." Reads ?t= (so the page renders it inside Suspense). */
export function ClaimSuccess() {
  const token = useSearchParams().get("t") ?? "";
  const q = useServiceQuery(() => (token ? services.content.getSenderEnvelope(token) : missing()), [token]);

  if (q.status === "loading") {
    return (
      <div className="grid min-h-[50dvh] place-items-center">
        <PaperLoader label="Opening your envelope…" />
      </div>
    );
  }
  if (q.status === "error") {
    return q.error.code === "network" ? (
      <Gentle
        title="We couldn't reach Saudade"
        body="Check your connection, then try again. Your envelope is safe."
        action={<InkButton onClick={() => q.reload()}>Try again</InkButton>}
      />
    ) : (
      <Gentle
        title="We couldn't find that envelope link"
        body="It may be incomplete, or it was replaced after a code reset. Claim with your code again, or have your link emailed to you."
        action={
          <>
            <InkLink href="/claim">Enter your code</InkLink>
            <InkLink href="/recover" variant="quiet">
              Email me my link
            </InkLink>
          </>
        }
      />
    );
  }
  return <Claimed key={token} token={token} envelope={q.data} />;
}

const NEXT = [
  ["Fill the four stamps", "Photos, a letter, your voice, a song. Save as you go."],
  ["Preview it", "See exactly what they'll see. It never counts as their first open."],
  ["Seal it, then give it", "Their first tap opens it. You can keep adding afterwards."],
] as const;

function Gentle({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <>
      <PageMasthead tone="sunset" eyebrow="Step 2 of 3 · Keep your link" title={title} />
      <div className="wrap pb-24">
        <PostcardSheet aria-label="What you can do">
          <p className="max-w-xl text-lede leading-relaxed text-ink-soft">{body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">{action}</div>
        </PostcardSheet>
      </div>
    </>
  );
}

function Claimed({ token, envelope }: { token: string; envelope: SenderEnvelope }) {
  const origin = useOrigin();
  const canShare = useCanShare();
  const link = `${origin}${senderPath(token)}`;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Link copied", {
        tone: "success",
        body: "Keep it somewhere safe, like your notes.",
      });
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      toast("Couldn't copy the link", {
        tone: "error",
        body: "Press and hold the link to copy it instead.",
      });
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "My Saudade envelope",
        text: "The private link to my Saudade envelope.",
        url: link,
      });
    } catch {
      // Cancelled by the person, nothing to do.
    }
  };

  return (
    <>
      <PageMasthead
        tone="sky"
        eyebrow="Step 2 of 3 · Keep your link"
        title={
          <>
            Your envelope is <em>yours.</em>
          </>
        }
        lede="This is your private link. Use it any time to add to your envelope or change what's inside, before or after you give it."
        art={
          <span className="ix-thunk block">
            <Postmark
              variant="circle"
              size={230}
              rotate={-12}
              place="SAUDADE · CLAIMED"
              date={envelope.unit.claimedAt ?? undefined}
              ink="red"
              opacity={0.95}
            />
          </span>
        }
      />
      <div className="wrap pb-24">
        <PostcardSheet
          aria-label="Your private link"
          side={
            <>
              <div className="ix-sidetop">
                <h2 className="display pt-2 text-d3 text-ink">
                  What happens <em>next</em>
                </h2>
                <StampBox className="shrink-0">
                  <Stamp kind="letter" width={60} rotate={4} />
                </StampBox>
              </div>
              <AddressLines items={NEXT.map(([t, b], i) => [`${i + 1} · ${t}`, b] as const)} />
              {site.captureSenderEmailAtClaim && (
                <div className="border-t-[1.5px] border-dashed border-paper-edge pt-6">
                  <EmailMe token={token} saved={envelope.unit.senderEmail} />
                </div>
              )}
            </>
          }
        >
          <p className="ix-dear">Keep this safe,</p>
          <p className="ix-hand">there&apos;s no password, just this link:</p>
          <p className="eyebrow mt-7 text-red-ink">Your private link</p>
          <p className="mt-2 select-all">
            <span className="ix-link" data-copied={copied ? "" : undefined}>
              {link || " "}
            </span>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <InkButton variant="secondary" onClick={copy} icon={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}>
              {copied ? "Copied" : "Copy link"}
            </InkButton>
            {canShare && (
              <InkButton variant="secondary" onClick={share} icon={<IconExternal size={18} />}>
                Share
              </InkButton>
            )}
          </div>

          <InkLink href={senderPath(token)} size="lg" className="mt-10">
            Start filling your envelope
          </InkLink>
        </PostcardSheet>
      </div>
    </>
  );
}

/** [O6] Optional: email the link to yourself, for recovery later. */
function EmailMe({ token, saved }: { token: string; saved: string | null }) {
  const [email, setEmail] = useState(saved ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter an email address, like name@example.com.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await services.units.saveSenderEmail(token, email.trim());
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error.code === "network"
          ? "We couldn't send it. Check your connection and try again."
          : res.error.code === "not_found"
            ? "This link isn't active any more. Claim your code again to get a new one."
            : res.error.code === "invalid_input"
              ? "Enter an email address, like name@example.com."
              : "We couldn't send it. Try again in a moment.",
      );
      return;
    }
    setSentTo(email.trim());
    toast("Your link is on its way", {
      tone: "success",
      body: `Sent to ${email.trim()}.`,
    });
  };

  return (
    <section aria-labelledby="email-me">
      <h2 id="email-me" className="display text-d3 text-ink">
        Email it to me <span className="block font-ui text-base font-medium text-ink">(optional)</span>
      </h2>
      <div aria-live="polite">
        {sentTo ? (
          <div className="mt-3 flex items-start gap-3 border-2 border-ink bg-paper-raised px-4 py-3">
            <IconCheck size={20} className="mt-0.5 shrink-0 text-sage-ink" />
            <div>
              <p className="leading-relaxed text-ink-soft">
                Sent to <strong className="font-medium text-ink">{sentTo}</strong>. If it&apos;s not there in a minute, check your spam folder.
              </p>
              <button
                type="button"
                className="-ml-1 tap-target px-1 text-left font-medium text-postmark underline underline-offset-2"
                onClick={() => setSentTo(null)}
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-3 space-y-3">
            <StampedInput
              label="Your email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              font="ui"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
              hint="We'll only use it to send you this link."
            />
            <InkButton type="submit" variant="secondary" loading={busy} loadingLabel="Sending your link">
              Send me the link
            </InkButton>
          </form>
        )}
      </div>
    </section>
  );
}
