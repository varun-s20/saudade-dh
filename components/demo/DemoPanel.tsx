"use client";

/**
 * The presenter's Demo Panel (MASTER_BUILD_PROMPT §6.2). Mounted by app/providers.tsx only when
 * demo mode is enabled (?demo=1, or a triple-tap on the logo).
 *
 * This is the ONE place outside the services allowed to touch lib/state/db and lib/demo/*:
 * it jumps the hero unit between lifecycle states, simulates taps, and forces errors.
 * Scenario jumps are full page loads, because a real NFC tap is a fresh page load.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EmailPreview } from "@/components/public/EmailPreview";
import { useNow } from "@/components/public/useNow";
import {
  HERO_STATES,
  heroLinks,
  loadSampleEnvelope,
  resetEverything,
  setHeroState,
  simulateEmptyEnvelope,
  simulateFirstTap,
  simulateRepeatVisit,
  simulateSenderPreview,
  type HeroState,
} from "@/lib/demo/actions";
import { HERO } from "@/lib/demo/seed";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { services } from "@/lib/services";
import { useDb } from "@/lib/state/db";
import { DEMO_ERROR_LABELS, useDemo, type DemoErrorKey, type MotionOverride } from "@/lib/state/demo";
import { toast } from "@/lib/state/toast";
import { duration, ease } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";
import { relativeTime } from "@/lib/utils/format";
import { PanelButton, PanelLink, PanelSection, Segmented, Switch, Tick } from "./parts";

const ERROR_KEYS = Object.keys(DEMO_ERROR_LABELS) as DemoErrorKey[];

/** Where each forced error shows up, so the presenter knows where to go next. */
const ERROR_WHERE: Record<DemoErrorKey, string> = {
  invalid_code: "Claim",
  already_claimed: "Claim",
  rate_limited: "Claim",
  upload_failed: "Photos, Voice",
  mic_denied: "Voice",
  in_app_browser: "Voice",
  network: "Everywhere",
};

const MOTION_OPTIONS = [
  { value: "system", label: "System" },
  { value: "reduce", label: "Reduce" },
  { value: "full", label: "Full" },
] as const satisfies readonly { value: MotionOverride; label: string }[];

const GO_TO: { href: string; label: string; needsClaim?: boolean }[] = [
  { href: heroLinks.claim, label: "Claim" },
  { href: heroLinks.portal, label: "Sender portal", needsClaim: true },
  { href: heroLinks.preview, label: "Preview", needsClaim: true },
  { href: heroLinks.seal, label: "Seal", needsClaim: true },
  { href: heroLinks.recipient, label: "Recipient page" },
  { href: heroLinks.notFound, label: "Not-found envelope" },
  { href: "/admin", label: "Admin" },
  { href: "/design-system", label: "Design system" },
  { href: "/design-system/directions", label: "Directions" },
  { href: "/design-system/motion", label: "Motion" },
];

/** Routes whose screens fetched hero data on load; reload them after a state jump. */
const reloadIfOnDataRoute = () => {
  const p = window.location.pathname;
  if (p.startsWith("/s/") || p.startsWith("/t/") || p.startsWith("/admin")) window.location.reload();
};

export function DemoPanel() {
  const open = useDemo((s) => s.open);
  const setOpen = useDemo((s) => s.setOpen);
  const forcedCount = useDemo((s) => ERROR_KEYS.filter((k) => s.forced[k]).length);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger (after the panel unmounts).
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setOpen]);

  return (
    <>
      <DemoTrigger ref={triggerRef} open={open} forcedCount={forcedCount} onClick={() => (open ? close() : setOpen(true))} />
      <AnimatePresence>{open && <DemoSheet key="demo-sheet" onClose={close} />}</AnimatePresence>
    </>
  );
}

// ─── Trigger: a small "DEMO" postmark ───────────────────────────────────────

function DemoTrigger({
  ref,
  open,
  forcedCount,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  open: boolean;
  forcedCount: number;
  onClick: () => void;
}) {
  const label = `${open ? "Close" : "Open"} demo panel${forcedCount ? ` (${forcedCount} error${forcedCount === 1 ? "" : "s"} forced)` : ""}`;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      aria-controls="demo-panel"
      className={cn(
        "fixed z-(--z-demo) grid size-12 place-items-center rounded-pill bg-paper-raised/95 text-postmark shadow-stamp transition-[opacity,transform] duration-(--motion-dur-fast) ease-out-soft",
        "right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        open ? "opacity-100" : "opacity-75 hover:opacity-100 focus-visible:opacity-100",
        "active:scale-95",
      )}
    >
      <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
        <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.5 1.5" />
        <text x="24" y="27.5" textAnchor="middle" fill="currentColor" style={{ fontFamily: "var(--ff-postal)", fontSize: 9.5, letterSpacing: "0.08em" }}>
          DEMO
        </text>
        <path d="M13 17.5h22M13 31.5h22" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
      </svg>
      {forcedCount > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-pill bg-red-ink px-1 font-postal text-xs leading-none text-ink-inverse shadow-flat"
        >
          {forcedCount}
        </span>
      )}
    </button>
  );
}

// ─── The panel ──────────────────────────────────────────────────────────────

type View = { name: "main" } | { name: "email"; id: string };

function DemoSheet({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotionPref();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ name: "main" });

  // Make sure the mock DB is seeded so the hero unit and outbox are readable.
  useEffect(() => {
    void services.email.outbox();
  }, []);

  // Focus the panel on open; Esc closes it.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const from = reduced ? { opacity: 0 } : { opacity: 0, y: 24 };
  const to = reduced ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <>
      {/* Phone only: a light scrim so the sheet reads as on top; tap to close. */}
      <motion.div
        aria-hidden
        className="fixed inset-0 z-(--z-demo) bg-ink/20 md:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        id="demo-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={from}
        animate={to}
        exit={from}
        transition={{ duration: duration.base, ease: ease.out }}
        className={cn(
          "fixed z-(--z-demo) flex flex-col overflow-clip bg-paper-raised paper-grain text-ink shadow-sheet outline-none",
          // Phone: bottom sheet.
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-sheet",
          // Desktop: a side card above the trigger.
          "md:inset-x-auto md:right-4 md:bottom-20 md:max-h-[calc(100dvh-7rem)] md:w-88 md:rounded-card md:shadow-lifted",
        )}
      >
        <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0">
            <p className="postal-label text-red-ink">Presenter only</p>
            <h2 id={titleId} className="font-display text-lg leading-tight">
              Demo panel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo panel"
            className="tap-target -mr-2 grid place-items-center rounded-pill text-ink-soft hover:bg-paper-deep"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {view.name === "main" ? (
            <MainView onOpenEmail={(id) => setView({ name: "email", id })} onClose={onClose} />
          ) : (
            <EmailView id={view.id} onBack={() => setView({ name: "main" })} />
          )}
        </div>
      </motion.div>
    </>
  );
}

function MainView({ onOpenEmail, onClose }: { onOpenEmail: (id: string) => void; onClose: () => void }) {
  const demo = useDemo();
  const heroStatus = useDb((s) => s.units[HERO.id]?.status);
  const outbox = useDb((s) => s.outbox);
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const heroState: HeroState | null = !heroStatus
    ? null
    : heroStatus === "unassigned" || heroStatus === "assigned"
      ? "unclaimed"
      : heroStatus;
  const heroLabel = HERO_STATES.find((h) => h.key === heroState)?.label ?? "Loading…";

  /** Run a presenter action with a busy flag and a plain error toast. */
  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) toast(done);
    } catch (err) {
      toast("That didn't work", { tone: "error", body: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const jump = (state: HeroState) =>
    run(
      `hero-${state}`,
      async () => {
        await setHeroState(state);
        reloadIfOnDataRoute();
      },
      `Hero unit is now ${HERO_STATES.find((h) => h.key === state)?.label}`,
    );

  /** Scenario jumps navigate away; close the panel first so the product has the stage. */
  const scenario = (key: string, fn: () => Promise<void>) =>
    run(key, async () => {
      demo.setOpen(false);
      await fn();
    });

  const disabled = busy !== null;

  return (
    <>
      <PanelSection title="Hero unit" aside={<span className="font-postal text-sm tracking-wider text-ink">{HERO.code}</span>}>
        <p className="mb-2 text-sm text-ink-soft" aria-live="polite">
          Now: <strong className="font-medium text-ink">{heroLabel}</strong>
        </p>
        <Segmented
          label="Jump the hero unit to a state"
          options={HERO_STATES.map((h) => ({ value: h.key, label: h.label }))}
          value={heroState}
          onChange={jump}
          disabled={disabled}
        />
      </PanelSection>

      <PanelSection title="Scenarios">
        <div className="grid grid-cols-2 gap-1.5">
          <ScenarioButton title="First tap" hint="Sealed, never opened" disabled={disabled} onClick={() => scenario("first", simulateFirstTap)} />
          <ScenarioButton
            title="Repeat visit"
            hint="With a “new” stamp"
            disabled={disabled}
            onClick={() => scenario("repeat", () => simulateRepeatVisit({ withNewStamp: true }))}
          />
          <ScenarioButton title="Empty envelope" hint="Still being written" disabled={disabled} onClick={() => scenario("empty", simulateEmptyEnvelope)} />
          <ScenarioButton title="Sender preview" hint="Won’t use up the reveal" disabled={disabled} onClick={() => scenario("preview", simulateSenderPreview)} />
        </div>
      </PanelSection>

      <PanelSection title="Go to">
        <nav aria-label="Demo shortcuts" className="flex flex-wrap gap-1">
          {GO_TO.map((l) => (
            <PanelLink key={l.href} href={l.href}>
              {l.label}
            </PanelLink>
          ))}
        </nav>
        {heroState === "unclaimed" && (
          <p className="mt-2 text-xs text-ink-faded">The hero is unclaimed, so the portal, preview and seal links show the “link not found” state.</p>
        )}
      </PanelSection>

      <PanelSection
        title="Force errors"
        aside={
          ERROR_KEYS.some((k) => demo.forced[k]) ? (
            <button type="button" onClick={demo.clearErrors} className="text-xs text-ink-soft underline underline-offset-2">
              Clear all
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2 md:grid-cols-1">
          {ERROR_KEYS.map((k) => (
            <Tick key={k} checked={Boolean(demo.forced[k])} onChange={() => demo.toggleError(k)}>
              <span className="flex-1">{DEMO_ERROR_LABELS[k]}</span>
              <span className="postal-label text-ink-faded">{ERROR_WHERE[k]}</span>
            </Tick>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Outbox" aside={outbox.length > 0 ? <span className="text-xs text-ink-faded">{outbox.length} sent</span> : null}>
        {outbox.length === 0 ? (
          <p className="text-sm text-ink-faded">No emails yet. Save an email after claiming, recover a link, or email a code from admin.</p>
        ) : (
          <ul className="-mx-1.5 space-y-0.5">
            {outbox.slice(0, 4).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenEmail(m.id)}
                  className="w-full rounded-soft px-1.5 py-1.5 text-left hover:bg-paper-deep/70 pointer-coarse:min-h-11"
                >
                  <span className="block truncate text-sm text-ink">{m.subject}</span>
                  <span className="block truncate text-xs text-ink-faded">
                    to {m.to}
                    {now > 0 && ` · ${relativeTime(m.sentAt, now)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title="Motion & speed">
        <Segmented<MotionOverride> label="Motion preference" options={MOTION_OPTIONS} value={demo.motion} onChange={demo.setMotion} />
        <div className="mt-2">
          <Switch checked={demo.fast} onChange={demo.setFast} label="Fast mode" hint="Skips the simulated network delay" />
        </div>
      </PanelSection>

      <PanelSection title="Data">
        <div className="flex flex-wrap gap-1.5">
          <PanelButton
            disabled={disabled}
            onClick={() =>
              run(
                "sample",
                async () => {
                  await loadSampleEnvelope();
                  reloadIfOnDataRoute();
                },
                "Mira’s sample envelope is loaded",
              )
            }
          >
            {busy === "sample" ? "Loading…" : "Load sample envelope"}
          </PanelButton>
          {!confirmReset && (
            <PanelButton disabled={disabled} onClick={() => setConfirmReset(true)}>
              Reset everything
            </PanelButton>
          )}
        </div>
        {confirmReset && (
          <div role="group" aria-label="Confirm reset" className="mt-2 rounded-soft border border-dashed border-danger/60 bg-paper p-2.5">
            <p className="text-sm text-ink">Reset all demo data? Every unit, email and upload goes back to the seed. This can’t be undone.</p>
            <div className="mt-2 flex gap-1.5">
              <PanelButton
                tone="danger"
                autoFocus
                disabled={disabled}
                onClick={() =>
                  run("reset", async () => {
                    await resetEverything();
                    demo.clearErrors();
                    setConfirmReset(false);
                    toast("Everything is back to the start");
                    reloadIfOnDataRoute();
                  })
                }
              >
                {busy === "reset" ? "Resetting…" : "Yes, reset"}
              </PanelButton>
              <PanelButton tone="quiet" onClick={() => setConfirmReset(false)}>
                Cancel
              </PanelButton>
            </div>
          </div>
        )}
      </PanelSection>

      <div className="flex items-center justify-between gap-2 border-t border-dashed border-paper-edge px-4 pt-2">
        <span className="text-xs text-ink-faded">Triple-tap the logo to bring it back.</span>
        <PanelButton
          tone="quiet"
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            onClose();
            demo.setEnabled(false);
            toast("Demo panel hidden", { body: "Triple-tap the Saudade logo to show it again." });
          }}
        >
          Hide demo panel
        </PanelButton>
      </div>
    </>
  );
}

function ScenarioButton({ title, hint, onClick, disabled }: { title: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 flex-col items-start justify-center rounded-soft border border-paper-edge bg-paper px-2.5 py-1.5 text-left transition-colors duration-(--motion-dur-fast) hover:bg-paper-deep disabled:opacity-50"
    >
      <span className="text-sm leading-tight text-ink">{title}</span>
      <span className="text-xs leading-tight text-ink-faded">{hint}</span>
    </button>
  );
}

function EmailView({ id, onBack }: { id: string; onBack: () => void }) {
  const message = useDb((s) => s.outbox.find((m) => m.id === id));
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);

  return (
    <div className="px-4 pb-2">
      <button ref={backRef} type="button" onClick={onBack} className="tap-target -ml-1 inline-flex items-center gap-1 rounded-soft px-1 text-sm text-ink-soft hover:text-ink">
        <span aria-hidden>←</span> Back to the panel
      </button>
      {message ? (
        <EmailPreview message={message} status="Demo outbox · simulated email" className="mt-1" />
      ) : (
        <p className="py-6 text-sm text-ink-faded">That email is no longer in the outbox.</p>
      )}
    </div>
  );
}
