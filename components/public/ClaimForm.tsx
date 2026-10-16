"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { CodeInput, type CodeInputState } from "@/components/forms/CodeInput";
import { InkButton } from "@/components/ui/InkButton";
import { site } from "@/config/site";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { formatCode } from "@/lib/parsing/codes";
import { services } from "@/lib/services";
import type { ServiceErrorCode } from "@/lib/services/types";
import { clock } from "@/lib/utils/format";
import { Turnstile } from "./Turnstile";

/** Plain, clear error copy (no postal metaphors except the agreed "found its envelope" line). */
const MESSAGES: Partial<Record<ServiceErrorCode, string>> = {
  invalid_code: "We can't find that code. Check the card in your box, or the email we sent you.",
  already_claimed: "This code has already found its envelope. If that's yours, check your email for your link.",
  rate_limited: "Too many tries in a row. Take a breath: you can try again shortly, and your code is still here.",
  network: "We couldn't reach Saudade. Check your connection and try again.",
  invalid_input: "That doesn't look like a code. Check the card in your box, or the email we sent you.",
  challenge_required: "One quick check that you're a person, then we'll open your envelope.",
};

/** The stamp-press success beat before moving on (MASTER_BUILD_PROMPT: ≤ 700 ms). */
const SUCCESS_MS = 700;
const SUCCESS_MS_REDUCED = 450;

/**
 * S2: enter the activation code, claim the envelope, then on to /claim/success.
 * `onEcho` reports what's typed and the form's state (the claim page mirrors it onto a ticket).
 *
 * If the server answers `challenge_required` (mass code-guessing has switched the bot check on),
 * a Turnstile check appears; once it passes, the claim is sent again with its one-time token.
 */
export function ClaimForm({ onEcho }: { onEcho?: (body: string, state: CodeInputState) => void }) {
  const router = useRouter();
  const reduced = useReducedMotionPref();
  const [body, setBody] = useState("");
  const [state, setState] = useState<CodeInputState>("idle");
  const [error, setError] = useState<{ code: ServiceErrorCode | "incomplete"; text: string } | null>(null);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [announce, setAnnounce] = useState("");
  /** Bot check on screen; the key changes to render a fresh widget (tokens are single-use). */
  const [challenge, setChallenge] = useState<number | null>(null);
  const succeeded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Rate-limit countdown (ticks only while limited).
  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const t = Date.now();
      if (t >= until) {
        setUntil(null);
        setError(null);
        setState("idle");
        setAnnounce("You can try your code again now.");
      } else setNow(t);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  // Activity keeps this page mounted after we navigate to /claim/success: start fresh next time.
  useLayoutEffect(() => {
    return () => {
      clearTimeout(timer.current);
      if (succeeded.current) {
        succeeded.current = false;
        setBody("");
        setState("idle");
        setError(null);
        setChallenge(null);
      }
    };
  }, []);

  useEffect(() => {
    onEcho?.(body, state);
  }, [body, state, onEcho]);

  const limited = until !== null;
  const remaining = limited ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  const busy = state === "checking" || state === "success";

  const submit = async (e?: FormEvent, challengeToken?: string) => {
    e?.preventDefault();
    if (busy || limited) return;
    if (body.length < site.codes.length) {
      setError({ code: "incomplete", text: `Enter all ${site.codes.length} characters after ${site.codes.prefix}-.` });
      setState("error");
      return;
    }
    // Waiting on the bot check: its success sends the claim (see onToken below).
    if (challenge !== null && !challengeToken) return;
    setError(null);
    setAnnounce("");
    setState("checking");
    const res = await services.units.claim(formatCode(body), challengeToken ? { challengeToken } : undefined);
    if (res.ok) {
      setState("success");
      setChallenge(null);
      succeeded.current = true;
      timer.current = setTimeout(() => router.push(`/claim/success?t=${encodeURIComponent(res.data.token)}`), reduced ? SUCCESS_MS_REDUCED : SUCCESS_MS);
      return;
    }
    const code = res.error.code;
    // Each check is good for one try: a fresh widget for the next one.
    if (challengeToken || code === "challenge_required") setChallenge(code === "challenge_required" && site.turnstileSiteKey ? Date.now() : null);
    if (code === "challenge_required" && site.turnstileSiteKey) {
      setError(null);
      setState("idle");
      setAnnounce(MESSAGES.challenge_required ?? "");
      return;
    }
    setError({ code, text: MESSAGES[code] ?? "Something went wrong. Try again in a moment." });
    setState("error");
    if (code === "rate_limited") {
      setNow(Date.now());
      setUntil(Date.now() + (res.error.retryAfterSec ?? site.rateLimit.claimCooldownSec) * 1000);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6">
      <CodeInput
        id="code-input"
        value={body}
        onChange={(v) => {
          setBody(v);
          // Editing clears a server error (but never the rate-limit wait).
          if (!limited && state === "error") {
            setError(null);
            setState("idle");
          }
        }}
        state={state}
        error={error?.text}
        label="Your activation code"
        hideLabel={false}
        autoFocus
        checkingText="Checking your code…"
        successText="That's the one. Your envelope is yours."
      />

      {challenge !== null && site.turnstileSiteKey && (
        <div className="mt-5" role="group" aria-labelledby="claim-check">
          <p id="claim-check" className="text-ink-soft">
            {MESSAGES.challenge_required}
          </p>
          <div className="mt-3">
            <Turnstile
              key={challenge}
              siteKey={site.turnstileSiteKey}
              onToken={(token) => void submit(undefined, token)}
              onError={() => {
                setError({ code: "network", text: "The check didn't load. Refresh the page and try again." });
                setState("error");
              }}
            />
          </div>
        </div>
      )}

      {error?.code === "already_claimed" && (
        <p className="mt-3 text-ink-soft">
          Can&apos;t find the email?{" "}
          <Link href="/recover" className="font-medium text-postmark underline underline-offset-2">
            Get your link again
          </Link>
          .
        </p>
      )}

      <InkButton type="submit" size="lg" fullWidth arrow className="mt-6" loading={state === "checking"} loadingLabel="Checking your code" disabled={limited || state === "success"}>
        {limited ? `Try again in ${clock(remaining)}` : error?.code === "network" ? "Try again" : "Open my envelope"}
      </InkButton>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </form>
  );
}
