"use client";

import { useState, type FormEvent } from "react";
import { EmailPreview, type EmailLike } from "@/components/public/EmailPreview";
import { services } from "@/lib/services";
import type { ServiceErrorCode, Unit } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { dateTime } from "@/lib/utils/format";
import { AdminDialog, ConfirmDialog } from "./ConfirmDialog";
import { giftCodeDraft, looksLikeEmail } from "./emailDraft";
import { AdminButton, AdminInput, Card, CopyButton } from "./ui";

const FAIL: Partial<Record<ServiceErrorCode, string>> = {
  not_found: "That unit no longer exists.",
  invalid_input: "Check what you entered and try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  unauthorized: "Your admin session has ended. Sign in again.",
};
const failText = (code: ServiceErrorCode) => FAIL[code] ?? "Something went wrong. Try again.";

/** S23 actions: email the code (Path B), reset the code, reset the reveal [PROPOSED]. */
export function UnitActions({ unit, lastCodeResetAt, onChanged }: { unit: Unit; lastCodeResetAt: string | null; onChanged: () => void }) {
  return (
    <Card title="Actions" bodyClassName="divide-y divide-admin-line p-0">
      <EmailCodeAction unit={unit} lastCodeResetAt={lastCodeResetAt} onChanged={onChanged} />
      <ResetCodeAction unit={unit} onChanged={onChanged} />
      <ResetRevealAction unit={unit} onChanged={onChanged} />
    </Card>
  );
}

function ActionBlock({ title, proposed, children }: { title: string; proposed?: boolean; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 md:px-5">
      <h3 className="text-sm font-medium text-admin-ink">
        {title}
        {proposed && (
          <span className="ml-2 rounded-pill border border-admin-line px-1.5 py-px text-xs font-normal text-admin-ink-soft" title="Proposed feature, pending the client's approval (O12)">
            Proposed
          </span>
        )}
      </h3>
      <div className="mt-1.5 space-y-3 text-sm text-admin-ink-soft">{children}</div>
    </div>
  );
}

// ─── Email code (Path B) ────────────────────────────────────────────────────

function EmailCodeAction({ unit, lastCodeResetAt, onChanged }: { unit: Unit; lastCodeResetAt: string | null; onChanged: () => void }) {
  const [to, setTo] = useState(unit.codeEmailedTo ?? unit.senderEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailLike | null>(null);
  const [sending, setSending] = useState(false);
  // A reset issues a fresh, unredeemed code even for a filled envelope, so gate on the code itself.
  const claimed = unit.codeRedeemedAt !== undefined ? Boolean(unit.codeRedeemedAt) : !(unit.status === "unassigned" || unit.status === "assigned");
  // Production lists return codes masked; there the service mints a fresh code when it sends.
  const masked = unit.code.includes("·");

  const preview = (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(to)) {
      setError("Enter the buyer's email address, like name@example.com.");
      return;
    }
    setError(null);
    setDraft(giftCodeDraft(unit.code, to, window.location.origin));
  };

  const send = async () => {
    setSending(true);
    const res = await services.admin.emailCode(unit.id, to);
    setSending(false);
    if (!res.ok) {
      toast("The email wasn't sent", { tone: "error", body: failText(res.error.code) });
      return;
    }
    setDraft(null);
    toast("Code sent", { tone: "success", body: `${unit.code} is on its way to ${res.data.to}.` });
    onChanged();
  };

  return (
    <ActionBlock title="Email the code (Path B)">
      <p>For gifts shipped straight to the friend: there&apos;s no card in the box, so the buyer gets the code by email.</p>
      {unit.codeEmailedAt &&
        (lastCodeResetAt && lastCodeResetAt > unit.codeEmailedAt ? (
          <p className="text-admin-ink">
            An earlier code went to <strong className="font-medium">{unit.codeEmailedTo}</strong> on {dateTime(unit.codeEmailedAt)}. The code was reset
            after that, so send the new one.
          </p>
        ) : (
          <p className="text-admin-ink">
            Last sent to <strong className="font-medium">{unit.codeEmailedTo}</strong> on {dateTime(unit.codeEmailedAt)}.
          </p>
        ))}
      {claimed ? (
        <p className="rounded-soft bg-admin-bg px-3 py-2">This code has already been used. If the sender needs a new one, reset the code first.</p>
      ) : (
        <form onSubmit={preview} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <AdminInput
            label="Buyer's email"
            name="buyer-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            error={error}
            className="flex-1"
          />
          <AdminButton type="submit" tone="primary" className={error ? "sm:mb-7" : undefined}>
            Preview email
          </AdminButton>
        </form>
      )}

      <AdminDialog
        open={draft !== null}
        onClose={() => {
          if (!sending) setDraft(null);
        }}
        title="Check the email before sending"
        description={
          <>
            To <strong className="font-medium text-admin-ink">{draft?.to}</strong>. Sending marks this unit as Path B.
          </>
        }
        footer={
          <>
            <AdminButton tone="quiet" onClick={() => setDraft(null)} disabled={sending}>
              Back
            </AdminButton>
            <AdminButton tone="primary" onClick={send} loading={sending} autoFocus>
              {sending ? "Sending…" : "Send email"}
            </AdminButton>
          </>
        }
      >
        {draft && <EmailPreview message={draft} interactive={false} status="Preview · not sent yet" />}
        {masked && <p className="mt-3 text-sm text-admin-ink-soft">A fresh code is generated when you send, and replaces the dots above.</p>}
      </AdminDialog>
    </ActionBlock>
  );
}

// ─── Reset code ─────────────────────────────────────────────────────────────

function ResetCodeAction({ unit, onChanged }: { unit: Unit; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<{ old: string; code: string } | null>(null);

  const reset = async () => {
    setBusy(true);
    const res = await services.admin.resetCode(unit.id);
    setBusy(false);
    if (!res.ok) {
      toast("The code wasn't reset", { tone: "error", body: failText(res.error.code) });
      return;
    }
    setConfirming(false);
    setNewCode({ old: unit.code, code: res.data.code });
    onChanged();
  };

  return (
    <ActionBlock title="Reset the code">
      <p>For a lost or compromised code. Issues a new code; everything inside, and the NFC link, stay the same.</p>
      <AdminButton onClick={() => setConfirming(true)}>Reset code…</AdminButton>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={reset}
        busy={busy}
        title={`Reset ${unit.code}?`}
        confirmLabel="Reset code"
      >
        <p className="text-sm leading-relaxed text-admin-ink">
          The old code and the sender&apos;s current private link will stop working. Everything inside the envelope stays as it is. Send the new code to the
          sender so they can get back in.
        </p>
        <p className="mt-2 text-xs text-admin-ink-soft">The link on the ceramic (what the recipient taps) doesn&apos;t change. You&apos;ll see the new code next.</p>
      </ConfirmDialog>

      <AdminDialog
        open={newCode !== null}
        onClose={() => setNewCode(null)}
        title="New code issued"
        description={newCode ? <>The old code {newCode.old} no longer works.</> : undefined}
        footer={
          <AdminButton tone="primary" onClick={() => setNewCode(null)} autoFocus>
            Done
          </AdminButton>
        }
      >
        {newCode && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-paper-edge bg-paper px-4 py-3">
              <span className="font-postal text-2xl tracking-[0.16em] text-admin-ink" aria-live="polite">
                {newCode.code}
              </span>
              <CopyButton text={newCode.code} label="Copy code" />
            </div>
            <p className="text-sm text-admin-ink-soft">
              Send it to the sender so they can get back in: use “Email the code” on this page, or reply to their support message. They claim it like a new
              code and find their envelope exactly as they left it.
            </p>
          </div>
        )}
      </AdminDialog>
    </ActionBlock>
  );
}

// ─── Reset reveal [PROPOSED] ────────────────────────────────────────────────

function ResetRevealAction({ unit, onChanged }: { unit: Unit; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const revealed = Boolean(unit.revealedAt) || unit.status === "revealed";

  const reset = async () => {
    setBusy(true);
    const res = await services.admin.resetReveal(unit.id);
    setBusy(false);
    if (!res.ok) {
      toast("The reveal wasn't reset", { tone: "error", body: failText(res.error.code) });
      return;
    }
    setConfirming(false);
    toast("Reveal reset", { tone: "success", body: "The next tap on the ceramic plays the opening again." });
    onChanged();
  };

  return (
    <ActionBlock title="Reset the first-tap reveal" proposed>
      <p>For a reveal that was spoiled by accident, or a re-gift. The next tap plays the opening again.</p>
      <AdminButton onClick={() => setConfirming(true)} disabled={!revealed} aria-describedby={!revealed ? "reveal-hint" : undefined}>
        Reset reveal…
      </AdminButton>
      {!revealed && (
        <p id="reveal-hint" className="text-xs">
          Not opened yet, so there&apos;s nothing to reset.
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={reset}
        busy={busy}
        tone="primary"
        title="Reset the first-tap reveal?"
        description="The next time anyone taps the ceramic, the envelope opens with the full first-tap reveal, as if for the first time. The earlier opening stays in the reveal history."
        confirmLabel="Reset reveal"
      />
    </ActionBlock>
  );
}
