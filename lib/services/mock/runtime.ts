/**
 * Shared plumbing for the mock services: hydration + seeding, simulated latency, audit logging,
 * and small helpers. Mock-only; the API implementations never import this.
 */
import { site } from "@/config/site";
import { generateId } from "@/lib/parsing/codes";
import type { AuditEntry, ContentMap, ServiceError, ServiceResult, StampKind, Unit, UnitStatus } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { dbHydrated, useDb, type DbState } from "@/lib/state/db";
import { useDemo } from "@/lib/state/demo";

/** Wait for localStorage hydration and seed on first ever use. Call at the top of every method. */
export async function ready(): Promise<void> {
  await dbHydrated();
  if (!useDb.getState().seeded) {
    // Loaded on demand: the seed + sample envelope only matter on a browser's very first visit,
    // so they stay out of every route's initial JavaScript.
    const { buildSeed } = await import("@/lib/demo/seed");
    if (!useDb.getState().seeded) useDb.setState(buildSeed());
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Realistic network latency (300–900 ms), skipped when the Demo Panel's "fast" mode is on. */
export async function latency(scale = 1): Promise<void> {
  if (useDemo.getState().fast) return sleep(60);
  const [min, max] = site.mockLatencyMs;
  return sleep((min + Math.random() * (max - min)) * scale);
}

export const nowIso = () => new Date().toISOString();

export const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = <T = never,>(code: ServiceError["code"], extra: Omit<ServiceError, "code"> = {}): ServiceResult<T> => ({
  ok: false,
  error: { code, ...extra },
});

export function db(): DbState {
  return useDb.getState();
}

export function update(fn: (draft: DbState) => Partial<DbState>): void {
  useDb.setState((s) => fn(s));
}

export function appendAudit(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }): void {
  const e: AuditEntry = { id: generateId("aud"), at: entry.at ?? nowIso(), ...entry };
  update((s) => ({ audit: [e, ...s.audit].slice(0, 2000) }));
}

export function unitByToken(token: string): Unit | undefined {
  return Object.values(db().units).find((u) => u.senderToken === token);
}

export function unitBySlug(slug: string): Unit | undefined {
  const s = slug.toLowerCase();
  return Object.values(db().units).find((u) => u.slug === s);
}

export function hasContent(map: ContentMap | undefined): boolean {
  return STAMP_KINDS.some((k: StampKind) => Boolean(map?.[k]));
}

/** claimed ⇄ filled follows content; sealed and revealed are sticky (sender can keep editing). */
export function statusAfterEdit(current: UnitStatus, map: ContentMap): UnitStatus {
  const filled = hasContent(map);
  if (current === "claimed" && filled) return "filled";
  if (current === "filled" && !filled) return "claimed";
  return current;
}

export function patchUnit(id: string, patch: Partial<Unit>): Unit {
  const next = { ...db().units[id], ...patch, updatedAt: nowIso() };
  update((s) => ({ units: { ...s.units, [id]: next } }));
  return next;
}
