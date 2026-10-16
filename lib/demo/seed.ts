/**
 * Seed data for the mock database. Deterministic (seeded PRNG) so every presenter sees the same
 * admin table. Runs on the client at first use (never at module load, never during prerender).
 *
 * Demo codes (MASTER_BUILD_PROMPT §6.2):
 *   SAUD-3K7M  valid, unclaimed: the "hero" unit the showcase claims and fills
 *   SAUD-9PXR  already claimed by another sender
 *   SAUD-0000  invalid (0 is never in the alphabet; the input explains why)
 */
import type { AuditEntry, Batch, ContentMap, Unit, UnitStatus } from "@/lib/services/types";
import type { DbState } from "@/lib/state/db";
import { emptyDb } from "@/lib/state/db";
import { site } from "@/config/site";
import { sampleLetter } from "@/lib/demo/sample";
import { CLAIMED_ELSEWHERE, HERO, LAUNCH_BATCH_ID } from "@/lib/demo/constants";

export { CLAIMED_ELSEWHERE, HERO, LAUNCH_BATCH_ID };




/** mulberry32: tiny deterministic PRNG for seed data only (never for real identifiers). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["ana", "ben", "chloe", "dev", "elif", "farah", "gus", "hana", "ivo", "june", "kai", "lena", "marco", "nia", "omar", "priya", "rosa", "sami", "tess", "yuki"];
const LAST = ["reyes", "okafor", "lindqvist", "patel", "moreau", "kowalski", "nakamura", "haddad", "silva", "brennan"];

export function buildSeed(now: number = Date.now()): DbState {
  const rand = prng(20261121);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const randChars = (chars: string, n: number) => Array.from({ length: n }, () => pick(chars.split(""))).join("");
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const DAY = 86_400_000;

  const db = emptyDb();
  db.seeded = true;

  const batch: Batch = {
    id: LAUNCH_BATCH_ID,
    label: "Launch run · 300",
    createdAt: iso(21 * DAY),
    count: 0,
    status: "generated",
    codeLength: site.codes.length,
    chipDomain: site.chipDomain,
    encodedAt: null,
    claimedCount: 0,
  };
  const units: Record<string, Unit> = {};
  const contents: Record<string, ContentMap> = {};
  const audit: AuditEntry[] = [];
  const usedCodes = new Set<string>([HERO.code, CLAIMED_ELSEWHERE.code, "SAUD-0000"]);

  let unitCounter = 0;
  const base = (id: string, code: string, slug: string, createdAgo: number): Unit => ({
    id,
    unitNo: `S-${String(++unitCounter).padStart(4, "0")}`,
    code,
    codeRedeemedAt: null,
    slug,
    status: "unassigned",
    path: null,
    batchId: LAUNCH_BATCH_ID,
    senderEmail: null,
    senderToken: null,
    createdAt: iso(createdAgo),
    updatedAt: iso(createdAgo),
    claimedAt: null,
    sealedAt: null,
    revealedAt: null,
    codeEmailedAt: null,
    codeEmailedTo: null,
  });

  // Hero unit: unclaimed, Path A (printed card in the box).
  units[HERO.id] = { ...base(HERO.id, HERO.code, HERO.slug, 21 * DAY), path: "A" };

  // Already claimed by someone else, filled.
  const elsewhereClaimed = 9 * DAY;
  units[CLAIMED_ELSEWHERE.id] = {
    ...base(CLAIMED_ELSEWHERE.id, CLAIMED_ELSEWHERE.code, CLAIMED_ELSEWHERE.slug, 21 * DAY),
    status: "filled",
    path: "A",
    senderEmail: CLAIMED_ELSEWHERE.email,
    senderToken: CLAIMED_ELSEWHERE.token,
    claimedAt: iso(elsewhereClaimed),
    codeRedeemedAt: iso(elsewhereClaimed),
    updatedAt: iso(2 * DAY),
  };
  contents[CLAIMED_ELSEWHERE.id] = {
    letter: {
      unitId: CLAIMED_ELSEWHERE.id,
      kind: "letter",
      version: 3,
      updatedAt: iso(2 * DAY),
      content: { kind: "letter", to: "Abuela", body: "The lemon tree you planted is taller than me now. I water it every Sunday and tell it about you.", signoff: "Con cariño,", from: "Jo" },
    },
  };
  audit.push({ id: "aud_seed_9pxr", unitId: CLAIMED_ELSEWHERE.id, action: "unit.claimed", actor: "sender", at: iso(elsewhereClaimed) });

  // Background units with a realistic spread of statuses.
  const plan: UnitStatus[] = [
    ...Array<UnitStatus>(14).fill("unassigned"),
    ...Array<UnitStatus>(4).fill("assigned"),
    ...Array<UnitStatus>(6).fill("claimed"),
    ...Array<UnitStatus>(6).fill("filled"),
    ...Array<UnitStatus>(3).fill("sealed"),
    ...Array<UnitStatus>(3).fill("revealed"),
  ];

  plan.forEach((status, i) => {
    let code: string;
    do code = `${site.codes.prefix}-${randChars(site.codes.alphabet, site.codes.length)}`;
    while (usedCodes.has(code));
    usedCodes.add(code);
    const id = `unit_${String(i + 1).padStart(3, "0")}`;
    const slug = randChars(site.ids.slugAlphabet, site.ids.slugLength);
    const u = base(id, code, slug, 21 * DAY);
    const email = `${pick(FIRST)}.${pick(LAST)}@example.com`;
    const claimedAgo = Math.floor((2 + rand() * 16) * DAY);

    if (status === "assigned") {
      const sentAgo = Math.floor((1 + rand() * 6) * DAY);
      Object.assign(u, { status, path: "B", codeEmailedAt: iso(sentAgo), codeEmailedTo: email, updatedAt: iso(sentAgo) });
      audit.push({ id: `aud_${id}_mail`, unitId: id, action: "unit.code_emailed", actor: "admin", at: iso(sentAgo), detail: email });
    } else if (status !== "unassigned") {
      const path = rand() < 0.75 ? "A" : "B";
      Object.assign(u, {
        status,
        path,
        senderEmail: rand() < 0.85 ? email : null,
        senderToken: randChars(site.ids.slugAlphabet, site.ids.tokenLength),
        claimedAt: iso(claimedAgo),
        codeRedeemedAt: iso(claimedAgo),
        updatedAt: iso(Math.floor(claimedAgo * rand())),
      });
      audit.push({ id: `aud_${id}_claim`, unitId: id, action: "unit.claimed", actor: "sender", at: iso(claimedAgo) });
      if (status === "filled" || status === "sealed" || status === "revealed") {
        contents[id] = {
          letter: { unitId: id, kind: "letter", version: 1, updatedAt: u.updatedAt, content: { ...sampleLetter, to: "", from: "", body: "A short note, written for someone far away." } },
        };
      }
      if (status === "sealed" || status === "revealed") {
        const sealedAgo = Math.floor(claimedAgo * 0.5);
        u.sealedAt = iso(sealedAgo);
        audit.push({ id: `aud_${id}_seal`, unitId: id, action: "unit.sealed", actor: "sender", at: iso(sealedAgo) });
      }
      if (status === "revealed") {
        const revealedAgo = Math.floor(claimedAgo * 0.2);
        u.revealedAt = iso(revealedAgo);
        audit.push({ id: `aud_${id}_rev`, unitId: id, action: "unit.revealed", actor: "recipient", at: iso(revealedAgo) });
      }
    }
    units[id] = u;
  });

  batch.count = Object.keys(units).length;
  audit.push({ id: "aud_batch_launch", unitId: null, action: "batch.generated", actor: "admin", at: iso(21 * DAY), detail: `${batch.count} units (seeded subset of the 300-unit launch run)` });

  db.units = units;
  db.contents = contents;
  db.batches = [batch];
  db.audit = audit.sort((a, b) => b.at.localeCompare(a.at));
  return db;
}
