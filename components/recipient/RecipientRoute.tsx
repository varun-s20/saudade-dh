"use client";

/**
 * The recipient route controller (/t/[slug], screens S15–S19). Reads the slug (so it renders
 * inside <Suspense>), loads the envelope through `services.reveal.getEnvelope`, and decides what
 * to show with `resolveRecipientMode`.
 *
 * First-open integrity (CLIENT_GUIDE §6.4, README rule 13):
 *   - Loading or rendering records nothing. GET has no side effects; reloading before the tap
 *     plays the ceremony again.
 *   - The reveal is recorded once, from <FirstTapReveal>'s onComplete (after the recipient's tap
 *     and the choreography, or Skip): services.reveal.markRevealed + this device's lastVisit.
 *   - Repeat visits: NEW marks are computed once from the lastVisit read at load, then this visit
 *     is remembered after the envelope has shown, so the marks are gone next time.
 *   - The sender preview never comes through here.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { services } from "@/lib/services";
import type { RecipientEnvelope, RecipientMode } from "@/lib/services/types";
import { newSince, resolveRecipientMode } from "@/lib/recipient-mode";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { useDevice } from "@/lib/state/device";
import type { RevealResult } from "@/components/reveal/FirstTapReveal";
import { RecipientExperience } from "./RecipientExperience";
import { RecipientLoading } from "./RecipientLoading";
import { EnvelopeNotFound, RecipientError } from "./RecipientNotice";

// The device store is localStorage-backed: wait for it before reading lastVisit (README rule 6).
const subscribeDevice = (cb: () => void) => useDevice.persist?.onFinishHydration(cb) ?? (() => undefined);
const deviceHydrated = () => useDevice.persist?.hasHydrated() ?? true;
const serverSnapshot = () => false;

export function RecipientRoute() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug ?? "").toLowerCase();
  const q = useServiceQuery(() => services.reveal.getEnvelope(slug), [slug]);
  const deviceReady = useSyncExternalStore(subscribeDevice, deviceHydrated, serverSnapshot);

  if (q.status === "error") {
    if (q.error.code === "not_found") return <EnvelopeNotFound />;
    return <RecipientError onRetry={() => void q.reload()} />;
  }
  if (q.status === "loading" || !deviceReady) return <RecipientLoading />;

  const env = q.data;
  // Re-keyed when an envelope stops (or starts) being "still being written", so a refreshed
  // envelope that has just been sealed starts from its own fresh snapshot (and its ceremony).
  const phase = resolveRecipientMode(env) === "empty" ? "empty" : "open";
  return <LoadedEnvelope key={`${slug}:${phase}`} slug={slug} env={env} reload={q.reload} />;
}

type ShownMode = Exclude<RecipientMode, "not_found">;

function LoadedEnvelope({ slug, env, reload }: { slug: string; env: RecipientEnvelope; reload: (quiet?: boolean) => Promise<void> }) {
  // Snapshot at load: the mode and this device's previous visit don't change under the
  // recipient's feet (recording the reveal mustn't flip the ceremony into a repeat visit).
  const [snap] = useState(() => ({
    mode: resolveRecipientMode(env) as ShownMode,
    lastVisit: useDevice.getState().lastVisit[slug] as string | undefined,
  }));
  const mode = snap.mode;
  const recorded = useRef(false);

  const newKinds = useMemo(() => (mode === "repeat" ? newSince(env.contents, snap.lastVisit) : undefined), [mode, env.contents, snap.lastVisit]);

  // Repeat visit: remember it once the envelope is on screen (effects run after paint). The NEW
  // marks above keep using the snapshot, so they stay for this visit and are gone next time.
  useEffect(() => {
    if (mode === "repeat") useDevice.getState().markVisited(slug, new Date().toISOString());
  }, [mode, slug, env]);

  // "Sender edits appear automatically": coming back to the tab quietly re-reads the envelope
  // (never during the first-tap ceremony, whose stamps are fixed once it starts).
  useEffect(() => {
    if (mode === "first_tap") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode, reload]);

  const onRevealComplete = useCallback(
    (result: RevealResult) => {
      if (recorded.current) return;
      recorded.current = true;
      useDevice.getState().markVisited(slug, new Date().toISOString());
      void recordReveal(slug, result);
    },
    [slug],
  );

  return <RecipientExperience env={env} mode={mode} newKinds={newKinds} variant="live" onRevealComplete={onRevealComplete} />;
}

/**
 * Record the first open. Idempotent on the server; a dropped connection is retried twice. Errors
 * are never shown to the recipient (the moment already happened), only logged.
 */
async function recordReveal(slug: string, result: RevealResult, attempt = 0): Promise<void> {
  try {
    const res = await services.reveal.markRevealed(slug, { skipped: result.skipped, reducedMotion: result.reducedMotion });
    if (res.ok) return;
    if (res.error.code === "network" && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return recordReveal(slug, result, attempt + 1);
    }
    console.warn(`[saudade] first open not recorded (${res.error.code})`);
  } catch (err) {
    console.warn("[saudade] first open not recorded", err);
  }
}
