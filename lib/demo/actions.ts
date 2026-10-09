/**
 * Presenter actions for the Demo Panel. These deliberately bypass the services (they jump the
 * hero unit between lifecycle states instantly) and are never used by product screens.
 *
 * Scenario jumps use full page loads (window.location.assign) because a real NFC tap is a fresh
 * page load, and because Next's Activity-preserved routes would otherwise keep stale state.
 */
import { recipientPath, senderPath } from "@/config/site";
import { CLAIMED_ELSEWHERE, HERO, buildSeed } from "@/lib/demo/seed";
import { sampleLetter, samplePhotos, sampleSong, sampleVoice } from "@/lib/demo/sample";
import { generateId } from "@/lib/parsing/codes";
import type { AuditAction, AuditEntry, ContentMap, Unit, UnitStatus } from "@/lib/services/types";
import { ready } from "@/lib/services/mock/runtime";
import { emptyDb, useDb } from "@/lib/state/db";
import { useDevice } from "@/lib/state/device";
import { clearBlobs } from "@/lib/state/media-store";

export type HeroState = "unclaimed" | "claimed" | "filled" | "sealed" | "revealed";

export const HERO_STATES: { key: HeroState; label: string }[] = [
  { key: "unclaimed", label: "Unclaimed" },
  { key: "claimed", label: "Claimed · draft" },
  { key: "filled", label: "Filled" },
  { key: "sealed", label: "Sealed" },
  { key: "revealed", label: "Revealed" },
];

export const heroLinks = {
  claim: "/claim",
  portal: senderPath(HERO.token),
  preview: `${senderPath(HERO.token)}/preview`,
  seal: `${senderPath(HERO.token)}/seal`,
  recipient: recipientPath(HERO.slug),
  notFound: recipientPath("zzzzzzzzzzzz"),
  claimedElsewherePortal: senderPath(CLAIMED_ELSEWHERE.token),
} as const;

function sampleContents(unitId: string, at: string, olderAt = at): ContentMap {
  return {
    photos: { unitId, kind: "photos", content: samplePhotos, version: 1, updatedAt: olderAt },
    letter: { unitId, kind: "letter", content: sampleLetter, version: 1, updatedAt: olderAt },
    voice: { unitId, kind: "voice", content: sampleVoice, version: 1, updatedAt: olderAt },
    song: { unitId, kind: "song", content: sampleSong, version: 1, updatedAt: at },
  };
}

/** Put the hero unit (SAUD-3K7M) into a lifecycle state. */
export async function setHeroState(state: HeroState, opts: { keepContent?: boolean } = {}): Promise<void> {
  await ready();
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const s = useDb.getState();
  const current = s.units[HERO.id];
  const existing = s.contents[HERO.id] ?? {};
  const hasExisting = Object.keys(existing).length > 0;

  const status: UnitStatus = state === "unclaimed" ? "unassigned" : state;
  const unit: Unit = {
    ...current,
    status,
    senderToken: state === "unclaimed" ? null : HERO.token,
    codeRedeemedAt: state === "unclaimed" ? null : (current.codeRedeemedAt ?? iso(3 * 3600_000)),
    claimedAt: state === "unclaimed" ? null : (current.claimedAt ?? iso(3 * 3600_000)),
    sealedAt: state === "sealed" || state === "revealed" ? (current.sealedAt ?? iso(3600_000)) : null,
    revealedAt: state === "revealed" ? (current.revealedAt ?? iso(1800_000)) : null,
    updatedAt: iso(0),
  };

  let contents: ContentMap = {};
  if (state === "filled" || state === "sealed" || state === "revealed") {
    contents = opts.keepContent && hasExisting ? existing : sampleContents(HERO.id, iso(2 * 3600_000));
  }

  // Keep the admin's timeline, reveal history and audit log truthful about demo jumps.
  const reveals = s.reveals.filter((r) => r.unitId !== HERO.id || state === "revealed");
  const audit = [...s.audit];
  const log = (action: AuditAction, actor: AuditEntry["actor"], at: string) =>
    audit.unshift({ id: generateId("aud"), unitId: HERO.id, action, actor, at, detail: "Demo Panel jump" });
  if (current.status !== status) {
    if (status === "claimed" || (current.status === "unassigned" && status !== "unassigned")) log("unit.claimed", "sender", unit.claimedAt ?? iso(0));
    if ((status === "sealed" || status === "revealed") && !current.sealedAt) log("unit.sealed", "sender", unit.sealedAt ?? iso(0));
    if (status === "revealed" && !current.revealedAt) {
      const at = unit.revealedAt ?? iso(0);
      reveals.unshift({ id: generateId("rev"), unitId: HERO.id, at, skipped: false, reducedMotion: false, userAgent: "Demo Panel (simulated)" });
      log("unit.revealed", "recipient", at);
    }
  }

  useDb.setState({
    units: { ...s.units, [HERO.id]: unit },
    contents: { ...s.contents, [HERO.id]: contents },
    reveals,
    audit,
  });
  if (state !== "revealed") useDevice.getState().forget(HERO.slug);
}

/** Fill the hero unit with Mira's sample envelope without changing whether it is sealed. */
export async function loadSampleEnvelope(): Promise<void> {
  await ready();
  const s = useDb.getState();
  const u = s.units[HERO.id];
  const status: UnitStatus = u.status === "unassigned" || u.status === "assigned" || u.status === "claimed" ? "filled" : u.status;
  useDb.setState({
    units: {
      ...s.units,
      [HERO.id]: {
        ...u,
        status,
        senderToken: HERO.token,
        claimedAt: u.claimedAt ?? new Date().toISOString(),
        codeRedeemedAt: u.codeRedeemedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    contents: { ...s.contents, [HERO.id]: sampleContents(HERO.id, new Date().toISOString()) },
  });
}

/** Wipe everything (mock DB, blobs, device memory) and re-seed. */
export async function resetEverything(): Promise<void> {
  await clearBlobs();
  useDb.setState({ ...emptyDb(), ...buildSeed() });
  useDevice.setState({ lastVisit: {} });
}

// ─── Scenario jumps (full page loads) ───────────────────────────────────────

const go = (path: string) => window.location.assign(path);

export async function simulateFirstTap() {
  const u = useDb.getState().units[HERO.id];
  const hasContent = Object.keys(useDb.getState().contents[HERO.id] ?? {}).length > 0;
  await setHeroState("sealed", { keepContent: hasContent && u.status !== "unassigned" });
  go(heroLinks.recipient);
}

export async function simulateRepeatVisit(opts: { withNewStamp?: boolean } = { withNewStamp: true }) {
  const hasContent = Object.keys(useDb.getState().contents[HERO.id] ?? {}).length > 0;
  await setHeroState("revealed", { keepContent: hasContent });
  // The device "last visited" an hour ago; the song was changed 2h ago → no badge, unless
  // withNewStamp, which bumps the song so it shows a "new" postmark.
  const lastVisit = new Date(Date.now() - 3600_000).toISOString();
  useDevice.getState().markVisited(HERO.slug, lastVisit);
  if (opts.withNewStamp) {
    const s = useDb.getState();
    const song = s.contents[HERO.id]?.song;
    if (song) {
      useDb.setState({
        contents: { ...s.contents, [HERO.id]: { ...s.contents[HERO.id], song: { ...song, version: song.version + 1, updatedAt: new Date().toISOString() } } },
      });
    }
  }
  go(heroLinks.recipient);
}

export async function simulateEmptyEnvelope() {
  await setHeroState("claimed");
  go(heroLinks.recipient);
}

export async function simulateSenderPreview() {
  const hasContent = Object.keys(useDb.getState().contents[HERO.id] ?? {}).length > 0;
  await setHeroState("filled", { keepContent: hasContent });
  go(heroLinks.preview);
}
