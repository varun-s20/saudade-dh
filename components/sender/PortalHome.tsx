"use client";

/**
 * S7 · Portal home: the sender's envelope with its four stamp slots (EnvelopeFace, the same
 * placement the recipient sees), the recipient-facing status in plain words, and the two big
 * actions (Preview, Seal & send) on a pinned slip.
 */
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EnvelopeFace, type FaceSlot } from "@/components/envelope/EnvelopeFace";
import { Odometer } from "@/components/motion/Odometer";
import { Stamp } from "@/components/stamps/Stamp";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconCheck, IconCopy, IconEye, IconMail, IconPlus } from "@/components/ui/icons";
import { STAMPS, WORLD_FILL } from "@/config/stamps";
import { senderPath, site } from "@/config/site";
import { filledKinds } from "@/lib/recipient-mode";
import type { SenderEnvelope, StampKind } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { dayMonth, stampSummary, stampSummarySpoken } from "./copy";
import { Dock } from "./SaveDock";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell } from "./SenderShell";
import { senderLinks, useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";

const noop = () => () => {};
const useOrigin = () =>
  useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );

export function PortalHome() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  const env = q.status === "success" ? q.data : null;

  return (
    <SenderShell token={token} width="wide" dock={env ? <HomeDock token={token} env={env} /> : undefined}>
      <EnvelopeGate query={q} reload={() => q.reload()}>
        {(data) => <HomeBody token={token} env={data} />}
      </EnvelopeGate>
    </SenderShell>
  );
}

type Phase = "empty" | "draft" | "ready" | "sealed" | "opened";

function phaseOf(env: SenderEnvelope): Phase {
  const { status, revealedAt } = env.unit;
  if (status === "revealed" || revealedAt) return "opened";
  if (status === "sealed") return "sealed";
  if (filledKinds(env.contents).length === 0) return "empty";
  // [O7] Without the seal step, a filled envelope already opens on the first tap.
  return site.requireSealBeforeReveal ? "draft" : "ready";
}

const LEDE: Record<Phase, string> = {
  empty: "Tap a stamp to fill it. Nothing reaches them until you seal it.",
  draft: "Add as much or as little as you like. When it feels ready, seal it.",
  ready: "Add as much or as little as you like. They can open it whenever they tap.",
  sealed: "Tap a stamp to add or change something. They'll see it the next time they tap.",
  opened: "Tap a stamp to add or change something. They'll see it the next time they tap.",
};

function HomeBody({ token, env }: { token: string; env: SenderEnvelope }) {
  const links = senderLinks(token);
  const phase = phaseOf(env);
  const letter = env.contents.letter?.content;
  const sealedAt = phase === "sealed" || phase === "opened" ? env.unit.sealedAt : null;

  return (
    <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="lg:col-start-1 lg:row-start-1">
        <p className="tag">Step 2 of 3 · Fill your envelope</p>
        <h1 className="ss-title ink-in mt-4">
          Your <em>envelope</em>
        </h1>
        <p className="ss-lede">{LEDE[phase]}</p>
        <StatusNotice env={env} phase={phase} />
        <div className="mt-6 hidden items-center gap-4 lg:flex">
          <HomeActions token={token} env={env} />
        </div>
      </div>

      <section aria-label="Stamps on your envelope" className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="ss-desk band-sea perf-edge">
          <div className="mx-auto w-full lg:max-w-[calc((100svh-8rem)*0.64)]">
            <EnvelopeFace
              toName={letter?.to}
              fromName={letter?.from}
              postmarkDate={sealedAt}
              // the summary tags ("1:08", the song) hang about 1rem below each stamp
              clearance={30}
              renderSlot={(kind, slot) => <Slot kind={kind} slot={slot} env={env} href={links[kind]} />}
            />
          </div>
        </div>
      </section>

      <div className="lg:col-start-1 lg:row-start-2">
        <StampChecklist env={env} links={links} />
        <KeepLinkSafe token={token} />
      </div>
    </div>
  );
}

// ─── Checklist (the same four stamps as a list: summaries + clear next actions) ───

function StampChecklist({ env, links }: { env: SenderEnvelope; links: ReturnType<typeof senderLinks> }) {
  const kinds: StampKind[] = ["photos", "letter", "voice", "song"];
  const done = filledKinds(env.contents).length;
  return (
    <section aria-labelledby="checklist-title" className="mt-2">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="checklist-title" className="display text-d3 text-ink">
          The four <em>stamps</em>
        </h2>
        <p className="eyebrow flex items-baseline gap-1.5 text-ink-faded">
          <Odometer value={String(done)} className="font-display text-[1.6rem] text-ink" /> of 4 filled
        </p>
      </div>
      <ul className="ss-list mt-4">
        {kinds.map((k, i) => {
          const def = STAMPS[k];
          const filled = Boolean(env.contents[k]);
          const summary = filled ? stampSummary(k, env.contents) : def.sender.emptyHint;
          return (
            <li key={k}>
              <Link href={links[k]} className="ss-row">
                <span
                  aria-hidden
                  className="ss-row__swatch perforated"
                  style={{ ["--world" as string]: WORLD_FILL[k], ["--tilt" as string]: `${i % 2 ? 3 : -3}deg` }}
                >
                  {filled ? <IconCheck size={18} strokeWidth={2.4} /> : `0${i + 1}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{def.label}</span>
                  <span className={filled ? "block truncate text-[0.95rem] text-ink-soft" : "block truncate text-[0.95rem] text-ink-faded"}>{summary}</span>
                </span>
                <span className="ss-row__go">
                  {filled ? "Edit" : "Add"}
                  <span className="sr-only"> {def.label.toLowerCase()}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

function StatusNotice({ env, phase }: { env: SenderEnvelope; phase: Phase }) {
  let title: string;
  let body: string;
  let tone: "draft" | "sealed" | "opened" = "draft";
  let mark = <IconMail size={18} />;

  switch (phase) {
    case "empty":
    case "draft":
      title = "Not sealed yet";
      body = "If they tap now, they'll see “Your letter is still being written.”";
      break;
    case "ready":
      title = "Ready to open";
      body = "Their first tap will open it, with the stamps appearing one by one.";
      tone = "sealed";
      break;
    case "sealed":
      title = env.unit.sealedAt ? `Sealed on ${dayMonth(env.unit.sealedAt)}` : "Sealed";
      body = "Their first tap will open it, with the stamps appearing one by one.";
      tone = "sealed";
      mark = <HeartSeal size={30} />;
      break;
    case "opened":
      title = env.unit.revealedAt ? `Opened on ${dayMonth(env.unit.revealedAt)}` : "Opened";
      body = "They've opened it. Anything you add or change appears the next time they tap.";
      tone = "opened";
      mark = <IconCheck size={18} />;
      break;
  }

  return (
    <div className="ss-notice mt-5" data-tone={tone} role="status">
      <span className={tone === "sealed" && phase === "sealed" ? "grid size-9 place-items-center" : "ss-notice__mark"} aria-hidden>
        {mark}
      </span>
      <div>
        <p className="ss-notice__title">{title}</p>
        <p className="ss-notice__body">{body}</p>
      </div>
    </div>
  );
}

// ─── Slots ───────────────────────────────────────────────────────────────────

function Slot({ kind, slot, env, href }: { kind: StampKind; slot: FaceSlot; env: SenderEnvelope; href: string }) {
  const def = STAMPS[kind];
  const record = env.contents[kind];

  // Artwork and postmarks sit beside the link, which is a transparent hit area on top: their
  // printed words are decoration, and text inside a control must be part of its accessible name
  // (WCAG 2.5.3 Label in Name).
  if (!record) {
    return (
      <div className="ss-slot">
        <Stamp
          kind={kind}
          width={slot.width}
          rotate={slot.rotate}
          empty
          emptyLabel={
            <span className="ss-slot__empty">
              <span className="ss-slot__name">
                <span className="ss-slot__plus">
                  <IconPlus size={11} strokeWidth={2.6} />
                </span>
                {def.sender.emptyTitle}
              </span>
              <span className="ss-slot__hint">{def.sender.emptyHint}</span>
            </span>
          }
        />
        <Link href={href} className="ss-slot__hit" aria-label={`${def.label}: not added yet. ${def.sender.emptyHint}`} />
      </div>
    );
  }

  const summary = stampSummary(kind, env.contents);
  const spoken = stampSummarySpoken(kind, env.contents);
  return (
    <div className="ss-slot">
      <Stamp kind={kind} width={slot.width} rotate={slot.rotate} postmark={{ date: record.updatedAt }} />
      {summary ? (
        <span className="ss-slot__tag" aria-hidden>
          {summary}
        </span>
      ) : null}
      <Link href={href} className="ss-slot__hit" aria-label={`${def.label}${spoken ? `: ${spoken}` : ""}. Change it`} />
    </div>
  );
}

// ─── Link safety + help ─────────────────────────────────────────────────────

function KeepLinkSafe({ token }: { token: string }) {
  const origin = useOrigin();
  const link = `${origin}${senderPath(token)}`;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Link copied", {
        tone: "success",
        body: "Keep it somewhere safe, like your notes.",
      });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      toast("Couldn't copy the link", {
        tone: "error",
        body: "Press and hold the address bar to copy it instead.",
      });
    }
  };

  return (
    <section aria-labelledby="keep-safe" className="mt-14 border-t border-dashed border-paper-edge pt-5">
      <h2 id="keep-safe" className="postal-label text-postmark">
        Keep this link safe
      </h2>
      <p className="mt-2 leading-relaxed text-ink-soft">
        This page&apos;s address is the only key to your envelope. There&apos;s no password, so keep it in your notes or email it to yourself.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <InkButton variant="secondary" onClick={copy} icon={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}>
          {copied ? "Copied" : "Copy link"}
        </InkButton>
        <InkLink href="/help/tap" variant="quiet">
          How tapping works
        </InkLink>
      </div>
    </section>
  );
}

// ─── Pinned actions ──────────────────────────────────────────────────────────

function HomeDock({ token, env }: { token: string; env: SenderEnvelope }) {
  return (
    <Dock label="Envelope actions" narrowOnly>
      <HomeActions token={token} env={env} />
    </Dock>
  );
}

/** Preview + Seal & send. In the pinned dock on phones/tablets; inline on wide screens. */
function HomeActions({ token, env }: { token: string; env: SenderEnvelope }) {
  const links = senderLinks(token);
  const phase = phaseOf(env);

  return (
    <>
      <InkLink href={links.preview} variant="secondary" icon={<IconEye size={18} />} className="shrink-0">
        Preview
      </InkLink>
      {phase === "empty" ? (
        <p className="ss-dock__status">Fill a stamp, then you can seal it.</p>
      ) : phase === "sealed" || phase === "opened" ? (
        <p className="ss-sealed-badge" aria-label="Sealed. You can keep editing.">
          <IconCheck size={18} /> Sealed
        </p>
      ) : phase === "ready" ? (
        <p className="ss-dock__status">Ready whenever they tap.</p>
      ) : (
        <InkLink href={links.seal} className="min-w-0 flex-1" fullWidth>
          Seal &amp; send
        </InkLink>
      )}
    </>
  );
}
