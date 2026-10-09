"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { StampedInput } from "@/components/forms/StampedInput";
import { Postmark } from "@/components/paper/Postmark";
import { InkButton } from "@/components/ui/InkButton";
import { site } from "@/config/site";
import { services } from "@/lib/services";
import type { EmailMessage } from "@/lib/services/types";
import { useDemo } from "@/lib/state/demo";
import { EmailPreview } from "./EmailPreview";

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * S4: ask for the private link again. Always the same confirmation, whether or not the email has
 * an envelope (no account enumeration). Demo mode adds "Open the email (demo)" so the presenter
 * can click the magic link from the simulated outbox.
 */
export function RecoverForm() {
  const demo = useDemo((s) => s.enabled);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [mail, setMail] = useState<{ status: "idle" | "loading" | "none" | "found"; message?: EmailMessage }>({ status: "idle" });
  const done = useRef(false);

  // Activity keeps this page mounted: don't greet the next visit with an old confirmation.
  useLayoutEffect(() => {
    return () => {
      if (done.current) {
        done.current = false;
        setSentTo(null);
        setMail({ status: "idle" });
      }
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter an email address, like name@example.com.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await services.units.recoverLink(email.trim());
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error.code === "rate_limited"
          ? "Too many requests for now. Wait a minute, then try again."
          : res.error.code === "network"
            ? "We couldn't send it. Check your connection and try again."
            : res.error.code === "invalid_input"
              ? "Enter an email address, like name@example.com."
              : "Something went wrong. Try again in a moment.",
      );
      return;
    }
    done.current = true;
    setSentTo(email.trim());
    setMail({ status: "idle" });
  };

  const openDemoEmail = async () => {
    setMail({ status: "loading" });
    const outbox = await services.email.outbox();
    const addr = sentTo?.toLowerCase();
    const message = outbox.find((m) => m.template === "recover_link" && m.to === addr);
    setMail(message ? { status: "found", message } : { status: "none" });
  };

  if (sentTo) {
    return (
      <div className="mt-8" aria-live="polite">
        <div className="flex items-start gap-4">
          <Postmark variant="circle" size={64} rotate={-10} place="SAUDADE · SENT" ink="postmark" className="shrink-0" />
          <div>
            <h2 className="font-display text-2xl leading-snug text-ink">If that email has an envelope, a link is on its way.</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              We sent it to <strong className="font-medium text-ink">{sentTo}</strong>. It can take a minute or two; check your spam folder too.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {demo && (
            <InkButton variant="secondary" onClick={openDemoEmail} loading={mail.status === "loading"} loadingLabel="Opening the outbox" fullWidth>
              Open the email (demo)
            </InkButton>
          )}
          <InkButton
            variant="quiet"
            fullWidth
            onClick={() => {
              setSentTo(null);
              setMail({ status: "idle" });
            }}
          >
            Try another email
          </InkButton>
        </div>

        {mail.status === "found" && mail.message && <EmailPreview message={mail.message} status="Demo outbox · the email you'd receive" className="mt-6" />}
        {mail.status === "none" && (
          <p className="mt-6 rounded-card border border-dashed border-paper-edge bg-paper-raised/60 px-4 py-3 text-sm leading-relaxed text-ink-soft">
            <span className="postal-label block text-ochre-ink">Demo only</span>
            No email was sent: that address has no envelope. A real visitor sees the same confirmation either way, so nobody can find out which emails
            have one.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-5">
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
        hint="The one you gave us after claiming your code."
        autoFocus
      />
      <InkButton type="submit" size="lg" fullWidth loading={busy} loadingLabel="Sending your link">
        Send me my link
      </InkButton>
      <p className="text-sm leading-relaxed text-ink-faded">
        Didn&apos;t leave an email? Write to{" "}
        <a href={`mailto:${site.supportEmail}`} className="text-postmark underline underline-offset-2">
          {site.supportEmail}
        </a>{" "}
        with your code, and we&apos;ll help you back in.
      </p>
    </form>
  );
}
