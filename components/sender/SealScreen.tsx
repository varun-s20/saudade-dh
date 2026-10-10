"use client";

/**
 * S14 · Seal & send [PROPOSED, O7]. A small ceremony: the envelope sits open with what's inside
 * peeking out; the sender presses and holds the wax seal where it will land (≈ 900 ms, a ring of
 * ticks inks in), the letter tucks in, the flap folds down, the seal presses on, a dated postmark
 * lands, and services.units.seal(token) arms the first-tap reveal (D-005).
 *
 * Plain alternatives: a "Seal it now" button (no holding), and keyboard / screen-reader activation
 * of the seal itself seals immediately. Reduced motion: the Envelope crossfades, nothing slides.
 * Already sealed or opened → that state, never a re-seal. Nothing inside → a gentle way to the editors.
 */
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Envelope, type EnvelopeState } from "@/components/envelope/Envelope";
import { ENVELOPE_ASPECT, FLAP_DEPTH, SEAL_CENTER_Y, SEAL_SIZE } from "@/components/envelope/Envelope";
import { Postmark } from "@/components/paper/Postmark";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { Stamp } from "@/components/stamps/Stamp";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconChevronRight, IconEye, IconRefresh } from "@/components/ui/icons";
import { r2 } from "@/components/paper/seeded";
import { site } from "@/config/site";
import { STAMPS } from "@/config/stamps";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { filledKinds } from "@/lib/recipient-mode";
import { services } from "@/lib/services";
import type { SenderEnvelope } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { dayMonth } from "./copy";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell } from "./SenderShell";
import { senderLinks, useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";

/** How long the seal must be held (ms). */
const HOLD_MS = 900;
const TICKS = 36;

type Phase = "ready" | "pressing" | "sealed" | "empty" | "error";

export function SealScreen() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  return (
    <SenderShell token={token} title="Seal & send">
      <EnvelopeGate query={q} reload={() => q.reload()}>
        {(env) => <SealBody key={env.unit.id} token={token} env={env} refresh={() => q.reload(true)} />}
      </EnvelopeGate>
    </SenderShell>
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function initialPhase(env: SenderEnvelope): Phase {
  if (env.unit.status === "sealed" || env.unit.status === "revealed" || env.unit.sealedAt) return "sealed";
  return filledKinds(env.contents).length ? "ready" : "empty";
}

function SealBody({ token, env, refresh }: { token: string; env: SenderEnvelope; refresh: () => void }) {
  const reduced = useReducedMotionPref();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(env));
  const [sealed, setSealed] = useState<SenderEnvelope | null>(initialPhase(env) === "sealed" ? env : null);
  const [ceremony, setCeremony] = useState(false);
  const [envState, setEnvState] = useState<EnvelopeState>(() => (initialPhase(env) === "sealed" ? "closed" : "open"));
  const [tucked, setTucked] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // The envelope came back sealed from elsewhere (another tab, the Demo Panel): show it.
  if (phase === "ready" && (env.unit.status === "sealed" || env.unit.status === "revealed")) {
    setPhase("sealed");
    setSealed(env);
    setEnvState("closed");
  }

  const kinds = filledKinds((sealed ?? env).contents);
  const letter = env.contents.letter?.content;

  const seal = async () => {
    if (phase !== "ready" && phase !== "error") return;
    setPhase("pressing");
    setCeremony(true);
    setErrorText(null);
    setAnnounce("Sealing your envelope…");
    setTucked(true);
    if (!reduced) await sleep(380);
    setEnvState("sealing");
    const [res] = await Promise.all([services.units.seal(token), sleep(reduced ? 450 : 1350)]);
    if (!live.current) return;
    if (!res.ok) {
      if (res.error.code === "nothing_to_seal") {
        setPhase("empty");
        return;
      }
      setEnvState("open");
      setTucked(false);
      setPhase("error");
      setErrorText(
        res.error.code === "network"
          ? "We couldn't seal it just now. Check your connection, then try again."
          : res.error.code === "not_found" || res.error.code === "unauthorized"
            ? "This link isn't active any more. Ask us to email you your link, then try again."
            : "Something went wrong while sealing. Try again in a moment.",
      );
      setAnnounce("");
      return;
    }
    setSealed(res.data);
    setPhase("sealed");
    setAnnounce("Sealed. Their first tap will open it.");
    refresh();
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  if (phase === "empty") return <NothingToSeal token={token} />;

  const sealedAt = sealed?.unit.sealedAt ?? null;
  const revealedAt = sealed?.unit.revealedAt ?? null;
  const isSealed = phase === "sealed";

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* kept through the sealing moment, so nothing jumps while the flap closes */}
      {!isSealed || ceremony ? (
        <p className="ss-lede">
          Once sealed, the next tap on the ceramic opens it, with the stamps appearing one by one. You can keep adding to it afterwards.
        </p>
      ) : null}

      {/* Already sealed when the page opened: the heading simply sits above the closed envelope. */}
      {isSealed && !ceremony ? <SealedHeading headingRef={headingRef} sealedAt={sealedAt} revealedAt={revealedAt} className="mt-2" /> : null}

      {/* The stage. While the flap is open (or closing) it keeps room above the envelope for the
          flap: a spacer sized from the envelope's own width (FLAP_DEPTH of its height). Once sealed
          in front of you, the heading rises into that room, just above the envelope. */}
      <div className={cn("ss-seal-stage", isSealed && !ceremony ? "mt-6" : "mt-4")}>
        {isSealed && !ceremony ? null : <div aria-hidden style={{ paddingTop: `${r2((FLAP_DEPTH / ENVELOPE_ASPECT) * 100)}%` }} />}
        {isSealed && ceremony ? (
          <div className="absolute inset-x-0 top-0 flex flex-col justify-center" style={{ aspectRatio: `${ENVELOPE_ASPECT / FLAP_DEPTH}` }}>
            <SealedHeading headingRef={headingRef} sealedAt={sealedAt} revealedAt={revealedAt} className="ss-rise" />
          </div>
        ) : null}

        <EnvelopeBox
          state={envState}
          toName={letter?.to || null}
          kinds={kinds}
          tucked={tucked}
          reduced={reduced}
          hold={
            phase === "ready" || phase === "pressing" || phase === "error"
              ? { disabled: phase === "pressing", onComplete: seal }
              : null
          }
          postmark={isSealed && sealedAt ? { date: sealedAt, animate: ceremony } : null}
        />
      </div>

      {phase === "ready" || phase === "error" ? (
        <ReadyFooter errorText={errorText} onSealNow={seal} />
      ) : phase === "pressing" ? (
        <p className="mt-6 text-center text-ink-soft" aria-hidden>
          Sealing…
        </p>
      ) : (
        <WhatNext token={token} slug={env.unit.slug} animate={ceremony} opened={Boolean(revealedAt)} />
      )}
    </>
  );
}

function SealedHeading({
  headingRef,
  sealedAt,
  revealedAt,
  className,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  sealedAt: string | null;
  revealedAt: string | null;
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <p className="postal-label text-postmark">{revealedAt ? `Opened on ${dayMonth(revealedAt)}` : sealedAt ? `Sealed on ${dayMonth(sealedAt)}` : "Sealed"}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-4xl leading-tight text-ink outline-none">
        {revealedAt ? "They've opened it." : "It's sealed."}
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-ink-soft">{revealedAt ? "Anything you add now appears the next time they tap." : "Their first tap will open it."}</p>
    </div>
  );
}

// ─── The envelope + the seal you press ────────────────────────────────────────

function EnvelopeBox({
  state,
  toName,
  kinds,
  tucked,
  reduced,
  hold,
  postmark,
}: {
  state: EnvelopeState;
  toName: string | null;
  kinds: ReturnType<typeof filledKinds>;
  tucked: boolean;
  reduced: boolean;
  hold: { disabled: boolean; onComplete: () => void } | null;
  postmark: { date: string; animate: boolean } | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sealSize = Math.round(width * SEAL_SIZE);

  return (
    <div ref={boxRef} className="relative">
      <Envelope
        state={state}
        toName={toName}
        className="w-full"
        contents={state === "closed" ? null : <LetterPeek kinds={kinds} tucked={tucked} reduced={reduced} />}
      />
      {hold && sealSize > 0 ? (
        <div className="absolute left-0 right-0" style={{ top: `${SEAL_CENTER_Y * 100}%` }}>
          <HoldToSeal sealSize={sealSize} disabled={hold.disabled} done={hold.disabled} onComplete={hold.onComplete} />
        </div>
      ) : null}
      {postmark ? (
        <div className={cn("pointer-events-none absolute", postmark.animate && "ss-postmark-land")} style={{ right: "-2%", top: "-12%", zIndex: 9 }}>
          <Postmark variant="wavy" wavySide="left" date={postmark.date} place="SAUDADE · SEALED" size={Math.max(64, Math.round(width * 0.24))} rotate={-8} />
        </div>
      ) : null}
    </div>
  );
}

/** What's inside, peeking out of the open envelope: the filled stamps on a folded sheet. */
function LetterPeek({ kinds, tucked, reduced }: { kinds: ReturnType<typeof filledKinds>; tucked: boolean; reduced: boolean }) {
  const rot = [-6, 4, -3, 5];
  return (
    <div
      aria-hidden
      className="absolute rounded-paper shadow-paper paper-fibre"
      style={{
        left: "11%",
        right: "11%",
        top: "-22%",
        height: "70%",
        backgroundColor: "var(--paper-raised)",
        transform: tucked && !reduced ? "translateY(34%)" : "none",
        opacity: tucked && reduced ? 0 : 1,
        transition: reduced
          ? "opacity var(--motion-dur-base) var(--motion-ease-out)"
          : "transform var(--motion-dur-slow) var(--motion-ease-lift)",
      }}
    >
      <div className="flex items-start justify-center gap-2 px-3 pt-[6%]">
        {kinds.map((k, i) => (
          <Stamp key={k} kind={k} width={46} rotate={rot[i % rot.length]} />
        ))}
      </div>
    </div>
  );
}

function HoldToSeal({ sealSize, disabled, done, onComplete }: { sealSize: number; disabled: boolean; done: boolean; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [held, setState] = useState<"idle" | "holding" | "pressed">("idle");
  // Sealed another way ("Seal it now"): the seal you were about to press lifts away all the same.
  const state = done ? "pressed" : held;
  const frame = useRef(0);
  /** rAF timestamp of the first frame of this hold. */
  const started = useRef<number | null>(null);
  const hintId = useId();
  // 1.35× the seal: the ticks still clear the wax, and the ring stays above "for Theo" below it
  const ring = Math.round(sealSize * 1.35);

  // Activity / unmount: never resume half-held.
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      setState((s) => (s === "holding" ? "idle" : s));
      setProgress((p) => (p < 1 ? 0 : p));
    },
    [],
  );

  const complete = () => {
    cancelAnimationFrame(frame.current);
    setProgress(1);
    setState("pressed");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(24);
    onComplete();
  };

  const tick = (now: number) => {
    started.current ??= now;
    const p = Math.min(1, (now - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) complete();
    else frame.current = requestAnimationFrame(tick);
  };

  const begin = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || state === "pressed" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    started.current = null;
    setState("holding");
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  };

  const release = () => {
    if (state !== "holding") return;
    cancelAnimationFrame(frame.current);
    setState("idle");
    setProgress(0);
  };

  const on = Math.round((done ? 1 : progress) * TICKS);

  return (
    <button
      type="button"
      className="ss-hold"
      style={{ width: ring, height: ring }}
      data-state={state}
      disabled={disabled && state !== "pressed"}
      aria-label="Seal your envelope. Press and hold the wax seal."
      aria-describedby={hintId}
      onPointerDown={begin}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // Keyboard and screen-reader activation (no pointer): seal straight away.
        if (e.detail === 0 && state === "idle" && !disabled) complete();
      }}
    >
      <svg className="ss-hold__ring" viewBox="0 0 100 100" aria-hidden focusable="false" style={{ color: "var(--wax)" }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.55" />
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          {TICK_PATHS.map((d, i) => (
            <path key={i} d={d} className="ss-hold__tick" data-on={i < on} />
          ))}
        </g>
      </svg>
      <span className="ss-hold__seal" aria-hidden>
        <HeartSeal size={sealSize} glow={state === "idle"} pressed={state === "pressed"} />
      </span>
      <span id={hintId} className="sr-only">
        Or use the Seal it now button below.
      </span>
    </button>
  );
}

const TICK_PATHS = Array.from({ length: TICKS }, (_, i) => {
  const a = -Math.PI / 2 + (i / TICKS) * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return `M${r2(50 + 38 * c)} ${r2(50 + 38 * s)}L${r2(50 + 45 * c)} ${r2(50 + 45 * s)}`;
});

// ─── Around the stage ────────────────────────────────────────────────────────

function ReadyFooter({ errorText, onSealNow }: { errorText: string | null; onSealNow: () => void }) {
  return (
    <div className="mt-6 text-center">
      <p className="font-hand text-2xl leading-tight text-ink-letter" aria-hidden>
        Press and hold the seal
      </p>
      <div aria-live="assertive">
        {errorText ? (
          <p className="ss-parse mt-3 justify-center" data-tone="error" role="alert">
            {errorText}
          </p>
        ) : null}
      </div>
      <InkButton variant="quiet" className="mt-2" onClick={onSealNow} icon={errorText ? <IconRefresh size={16} /> : undefined}>
        {errorText ? "Try again" : "Seal it now, without holding"}
      </InkButton>
    </div>
  );
}

const noop = () => () => {};
const useOrigin = () =>
  useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );

function WhatNext({ token, slug, animate, opened }: { token: string; slug: string; animate: boolean; opened: boolean }) {
  const links = senderLinks(token);
  return (
    <section aria-labelledby="what-next" className={cn("mt-8", animate && "ss-rise")} style={animate ? { animationDelay: "var(--motion-dur-slow)" } : undefined}>
      <h2 id="what-next" className="postal-label text-ink-soft">
        What happens next
      </h2>
      <ol className="ss-next">
        {opened ? (
          <>
            <li>
              <strong>It&apos;s theirs now.</strong> They can tap the heart whenever they like; it opens calmly, straight to the envelope.
            </li>
            <li>
              <strong>Keep adding.</strong> New photos, a new song, another voice note: changes appear for them automatically.
            </li>
          </>
        ) : (
          <>
            <li>
              <strong>Give them the ceramic envelope.</strong> Or send it on its way.
            </li>
            <li>
              <strong>They tap the heart with their phone.</strong> The envelope opens, and the stamps appear one by one.
            </li>
            <li>
              <strong>You can keep adding to it.</strong> Anything you change appears for them automatically.
            </li>
          </>
        )}
      </ol>
      {site.showRecipientLinkAfterSeal ? <RecipientLink slug={slug} /> : null}
      <div className="mt-8 flex flex-col gap-3">
        <InkLink href={links.home} fullWidth>
          Back to your envelope
        </InkLink>
        <div className="flex flex-wrap items-center justify-center gap-x-4">
          <InkLink href={links.preview} variant="quiet" icon={<IconEye size={18} />}>
            Preview what they&apos;ll see
          </InkLink>
          <InkLink href="/help/tap" variant="quiet">
            How tapping works
          </InkLink>
        </div>
      </div>
    </section>
  );
}

function NothingToSeal({ token }: { token: string }) {
  const links = senderLinks(token);
  return (
    <div className="ss-rise">
      <p className="ss-lede">An envelope needs something inside before it&apos;s sealed. Add at least one stamp first. Any of these will do:</p>
      <ul className="mt-6 grid grid-cols-2 gap-3">
        {STAMP_KINDS.map((k) => (
          <li key={k}>
            <Link href={links[k]} className="ss-card flex min-h-24 items-center gap-3 text-ink no-underline" aria-label={`Add ${STAMPS[k].sender.editorTitle.toLowerCase()}`}>
              <Stamp kind={k} width={44} rotate={STAMPS[k].place.rotate} />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-1">
                <span className="font-display text-lg leading-tight">{STAMPS[k].label}</span>
                <IconChevronRight size={18} className="shrink-0 text-ink-faded" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <InkLink href={links.home} variant="quiet" className="mt-6">
        Back to your envelope
      </InkLink>
    </div>
  );
}

/**
 * [SHOWCASE] The address the ceramic's heart opens. In the product, nobody sends anything: the
 * recipient holds their phone to the heart and the chip opens this page. With no ceramic in the
 * showcase, the sender (or the presenter) can open or send this address to try the first tap.
 * Off with `site.showRecipientLinkAfterSeal` before launch.
 */
function RecipientLink({ slug }: { slug: string }) {
  const origin = useOrigin();
  const url = `${origin}/t/${slug}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // the address stays visible to copy by hand
    }
  };
  return (
    <div className="ss-recip mt-6">
      <p className="postal-label text-ink-soft">The address the heart opens</p>
      <p className="mt-1 text-[0.95rem] leading-snug text-ink-soft">
        In the ceramic, the heart opens this page when they tap it with their phone. With no ceramic to hand, open it or send it to them
        to try the first tap.
      </p>
      <p className="ss-recip__url mt-3 font-mono text-sm break-all text-ink">{url}</p>
      <div className="mt-3 flex flex-wrap gap-x-4">
        <InkButton variant="quiet" onClick={copy}>
          {copied ? "Copied" : "Copy the address"}
        </InkButton>
        <InkLink href={url} variant="quiet" target="_blank">
          Open it
        </InkLink>
      </div>
    </div>
  );
}
