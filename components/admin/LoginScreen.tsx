"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "@/components/ui/Logo";
import { dataSource, services } from "@/lib/services";
import { DEMO_ADMIN } from "@/lib/services/mock";
import type { AdminSession, ServiceError } from "@/lib/services/types";
import { AdminButton, AdminInput } from "./ui";

/** Where a fresh session goes: the panel, or first the authenticator set-up. */
const homeFor = (s: AdminSession) => (s.twoFactor === "enrol" ? "/admin/security" : "/admin/dashboard");

function errorText(e: ServiceError, step: "password" | "code"): string {
  if (e.code === "unauthorized") {
    if (e.detail === "locked") return "Too many wrong attempts. This account is locked for 15 minutes.";
    if (e.detail === "invalid_otp") return "That code didn't work. Codes change every 30 seconds: try the newest one.";
    return step === "code" ? "That code didn't work." : "That email and password don't match. Check them and try again.";
  }
  if (e.code === "rate_limited") return "Too many attempts. Wait a minute, then try again.";
  if (e.code === "invalid_input") return "Enter your email and password.";
  if (e.code === "network") return "We couldn't reach the server. Check your connection and try again.";
  return "Something went wrong. Try again.";
}

/**
 * S20: admin sign-in. Step 1 is email and password; when the account has an authenticator
 * (two-factor sign-in, AQ5) step 2 asks for its 6-digit code, or one of the recovery codes.
 * Signed-in admins go straight on.
 */
export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void services.admin.getSession().then((s) => {
      if (alive && s) router.replace(homeFor(s));
    });
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step, recovery]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (step === "code" && !code.trim()) {
      setError(recovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await services.admin.signIn(email, password, step === "code" ? code : undefined);
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "unauthorized" && res.error.detail === "otp_required") {
        setStep("code");
        return;
      }
      setError(errorText(res.error, step));
      if (step === "code") setCode("");
      return;
    }
    // Activity keeps this page mounted: don't leave the secrets sitting in the fields.
    setPassword("");
    setCode("");
    setStep("password");
    router.push(homeFor(res.data));
  };

  return (
    <main className="grid min-h-dvh grid-paper lg:grid-cols-[1fr_1fr]">
      <aside aria-hidden className="relative hidden overflow-hidden band-cobalt lg:flex lg:flex-col lg:justify-between lg:p-14">
        <span className="absolute right-[-8rem] bottom-[-8rem] aspect-square w-[24rem] rounded-pill bg-ochre/90" />
        <p className="relative eyebrow text-ochre">Saudade · Admin</p>
        <p className="relative max-w-md display text-d1 text-paper">
          Every envelope, from the factory run <em>to the first tap.</em>
        </p>
        <p className="relative max-w-sm text-paper/75">Orders, codes, batches and support. Calm tools for a small, careful operation.</p>
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-baseline justify-center gap-2">
            <Logo size="md" />
            <span className="postal-label text-admin-ink-soft">Admin</span>
          </div>

          <form
            onSubmit={submit}
            noValidate
            className="border-2 border-admin-ink bg-admin-surface p-5 shadow-print md:p-6"
            aria-describedby="login-error"
          >
            {step === "password" ? (
              <>
                <h1 className="display text-2xl text-admin-ink">Sign in</h1>
                <p className="mt-1 text-sm text-admin-ink-soft">Orders, codes and support for Saudade.</p>

                <div className="mt-5 grid gap-4">
                  <AdminInput
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <AdminInput
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <h1 className="display text-2xl text-admin-ink">{recovery ? "Use a recovery code" : "Enter your code"}</h1>
                <p className="mt-1 text-sm text-admin-ink-soft">
                  {recovery
                    ? "Each recovery code works once. Set up your authenticator again afterwards if your phone is gone."
                    : `Open your authenticator app and enter the 6-digit code for Saudade (${email.trim()}).`}
                </p>
                <div className="mt-5">
                  <AdminInput
                    ref={codeRef}
                    label={recovery ? "Recovery code" : "6-digit code"}
                    name={recovery ? "recovery-code" : "one-time-code"}
                    type="text"
                    autoComplete={recovery ? "off" : "one-time-code"}
                    inputMode={recovery ? "text" : "numeric"}
                    pattern={recovery ? undefined : "[0-9]*"}
                    maxLength={recovery ? 14 : 6}
                    spellCheck={false}
                    autoCapitalize="off"
                    value={code}
                    onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ""))}
                    inputClassName="font-postal tracking-[0.2em]"
                    required
                  />
                </div>
              </>
            )}

            <p id="login-error" role="alert" aria-live="assertive" className="mt-3 min-h-5 text-sm text-danger">
              {error}
            </p>

            <AdminButton type="submit" tone="primary" loading={busy} className="mt-2 w-full">
              {busy ? "Signing in…" : step === "code" ? "Verify and sign in" : "Sign in"}
            </AdminButton>

            {step === "code" && (
              <div className="mt-3 flex flex-wrap justify-between gap-2">
                <AdminButton
                  tone="quiet"
                  onClick={() => {
                    setRecovery((r) => !r);
                    setCode("");
                    setError(null);
                  }}
                >
                  {recovery ? "Use the authenticator instead" : "Use a recovery code"}
                </AdminButton>
                <AdminButton
                  tone="quiet"
                  onClick={() => {
                    setStep("password");
                    setCode("");
                    setRecovery(false);
                    setError(null);
                  }}
                >
                  Back
                </AdminButton>
              </div>
            )}
          </form>

          {dataSource === "mock" && (
            <aside className="mt-6 border-2 border-dashed border-admin-ink/40 bg-paper p-4 text-sm text-admin-ink-soft" aria-label="Demo sign-in">
              <p className="postal-label text-admin-ink-soft">Prototype · demo sign-in</p>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 break-words">
                <dt>Email</dt>
                <dd className="font-medium text-admin-ink select-all">{DEMO_ADMIN.email}</dd>
                <dt>Password</dt>
                <dd className="font-medium text-admin-ink select-all">{DEMO_ADMIN.password}</dd>
              </dl>
              <AdminButton
                tone="secondary"
                className="mt-3"
                onClick={() => {
                  setEmail(DEMO_ADMIN.email);
                  setPassword(DEMO_ADMIN.password);
                  setError(null);
                }}
              >
                Fill in the demo sign-in
              </AdminButton>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
