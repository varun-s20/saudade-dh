"use client";

/**
 * Admin · Security (AQ5): two-factor sign-in. With TOTP_ENC_KEY set on the deployment every admin
 * needs an authenticator app (Google Authenticator, 1Password, Authy…). A first sign-in lands here
 * and can't use the rest of the panel until the authenticator is set up. Ten single-use recovery
 * codes are shown once, for a lost phone; they can be replaced here later. Losing both the phone
 * and the codes is fixed from a terminal (scripts/admin-user.mjs reset-2fa), never from the web.
 */
import { useState, type FormEvent } from "react";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import type { AdminSecurity, TwoFactorSetup } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { dateTime } from "@/lib/utils/format";
import { loadErrorText, useUnauthorizedRedirect } from "./DashboardScreen";
import { AdminButton, AdminInput, Card, CopyButton, Field, LoadError, PageHeader, Skeleton } from "./ui";

type Phase = { kind: "status" } | { kind: "setup"; setup: TwoFactorSetup } | { kind: "codes"; codes: string[]; afterEnrol: boolean };

const group = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

export function SecurityScreen() {
  const query = useServiceQuery(() => services.admin.getSecurity(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "status" });
  useUnauthorizedRedirect(query.error);
  const security = query.status === "success" ? query.data : null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Security"
        description="Two-factor sign-in: your password, plus a 6-digit code from an authenticator app on your phone."
      />
      {query.status === "error" && query.error.code !== "unauthorized" && <LoadError message={loadErrorText(query.error)} onRetry={() => query.reload()} />}
      {query.status === "loading" && <Skeleton className="h-48" />}
      {security && phase.kind === "status" && <Status security={security} onStart={(setup) => setPhase({ kind: "setup", setup })} onCodes={(codes) => setPhase({ kind: "codes", codes, afterEnrol: false })} />}
      {phase.kind === "setup" && <Enrol setup={phase.setup} onDone={(codes) => setPhase({ kind: "codes", codes, afterEnrol: true })} onCancel={() => setPhase({ kind: "status" })} />}
      {phase.kind === "codes" && (
        <RecoveryCodes
          codes={phase.codes}
          onDone={() => {
            if (phase.afterEnrol) {
              // The session is now two-factor; a full load refreshes the shell and every preserved
              // (Activity) screen, as the shell's sign-out does.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/admin/dashboard");
            } else {
              setPhase({ kind: "status" });
              void query.reload();
            }
          }}
        />
      )}
    </div>
  );
}

function Status({ security, onStart, onCodes }: { security: AdminSecurity; onStart: (s: TwoFactorSetup) => void; onCodes: (codes: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    const res = await services.admin.startTwoFactor();
    setBusy(false);
    if (res.ok) onStart(res.data);
    else toast("Couldn't start the set-up", { tone: "error", body: res.error.detail ?? "Try again." });
  };

  const replaceCodes = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await services.admin.regenerateRecoveryCodes(code);
    setBusy(false);
    setCode("");
    if (res.ok) onCodes(res.data.recoveryCodes);
    else setError("That code didn't work. Codes change every 30 seconds: try the newest one.");
  };

  if (security.twoFactor === "off") {
    return (
      <Card title="Two-factor sign-in is off">
        <p className="max-w-prose text-sm text-admin-ink-soft">
          This deployment signs admins in with a password only. To require an authenticator code for every admin, set{" "}
          <code className="font-postal text-admin-ink">TOTP_ENC_KEY</code> in the host&apos;s environment (docs/HANDOVER.md §4) and redeploy. Each admin
          then sets up their authenticator at their next sign-in.
        </p>
      </Card>
    );
  }

  if (security.twoFactor === "not_enrolled") {
    return (
      <Card title="Set up your authenticator" description="Required before you can use the admin.">
        <ol className="max-w-prose list-decimal space-y-1.5 pl-5 text-sm text-admin-ink-soft">
          <li>Install an authenticator app on your phone if you don&apos;t have one (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
          <li>Scan the QR code we show you next, and type in the 6-digit code it gives you.</li>
          <li>Save the ten recovery codes somewhere safe, away from your phone.</li>
        </ol>
        <AdminButton tone="primary" className="mt-5" loading={busy} onClick={start}>
          Start set-up
        </AdminButton>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Two-factor sign-in is on">
        <dl className="divide-y divide-admin-line">
          <Field label="Authenticator">Set up {security.enrolledAt ? dateTime(security.enrolledAt) : ""}</Field>
          <Field label="Recovery codes">
            {security.recoveryCodesLeft} of 10 left{security.recoveryCodesLeft <= 3 ? ": replace them soon" : ""}
          </Field>
        </dl>
        <p className="mt-3 text-xs text-admin-ink-soft">
          New phone? Sign in with a recovery code, then ask the developer to reset your authenticator so you can set it up again.
        </p>
      </Card>
      <Card title="Replace recovery codes" description="Every old code stops working.">
        <form onSubmit={replaceCodes} noValidate className="grid gap-3">
          <AdminInput
            label="Current 6-digit code"
            name="current-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            error={error}
            inputClassName="font-postal tracking-[0.2em]"
          />
          <AdminButton type="submit" tone="secondary" loading={busy} className="justify-self-start">
            Make new recovery codes
          </AdminButton>
        </form>
      </Card>
    </div>
  );
}

function Enrol({ setup, onDone, onCancel }: { setup: TwoFactorSetup; onDone: (codes: string[]) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code your app shows for Saudade.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await services.admin.confirmTwoFactor(setup.pending, code);
    setBusy(false);
    if (res.ok) onDone(res.data.recoveryCodes);
    else {
      setCode("");
      setError(res.error.detail?.includes("expired") ? "This set-up expired. Go back and start again." : "That code didn't match. Check your phone's clock is set automatically, then try the newest code.");
    }
  };

  return (
    <Card title="Scan this with your authenticator app" description="Or type the key in by hand.">
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
        {/* A data: URL, generated on the server; nothing is fetched from elsewhere. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrDataUrl} alt="QR code to add Saudade to your authenticator app" width={232} height={232} className="rounded-soft border-2 border-admin-line bg-white p-1" />
        <div className="grid min-w-0 gap-4">
          <div>
            <p className="text-sm font-medium text-admin-ink">Key</p>
            <p className="mt-1 font-postal text-base tracking-wider [overflow-wrap:anywhere] text-admin-ink select-all">{group(setup.secret)}</p>
            <CopyButton text={setup.secret} label="Copy key" className="mt-2" />
            <p className="mt-2 text-xs text-admin-ink-soft">Time-based, 6 digits, every 30 seconds.</p>
          </div>
          <form onSubmit={confirm} noValidate className="grid gap-3">
            <AdminInput
              label="Code from the app"
              name="first-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              error={error}
              inputClassName="font-postal tracking-[0.2em]"
            />
            <div className="flex flex-wrap gap-2">
              <AdminButton type="submit" tone="primary" loading={busy}>
                Confirm
              </AdminButton>
              <AdminButton tone="quiet" onClick={onCancel}>
                Back
              </AdminButton>
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `Saudade admin recovery codes (each works once)\n\n${codes.join("\n")}\n`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "saudade-admin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card title="Save your recovery codes" description="Shown once. Each one signs you in a single time if you lose your phone.">
      <ul className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1.5 font-postal text-base tracking-wider text-admin-ink" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={text} label="Copy all" />
        <AdminButton tone="secondary" className="min-h-9 px-3 pointer-fine:md:min-h-8" onClick={download}>
          Download as a file
        </AdminButton>
      </div>
      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm text-admin-ink">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-5 accent-navy" />
        I&apos;ve saved these somewhere safe, away from my phone
      </label>
      <AdminButton tone="primary" className="mt-3" disabled={!saved} onClick={onDone}>
        Continue
      </AdminButton>
    </Card>
  );
}
