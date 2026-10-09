/**
 * The mock "server database" for the Phase 2 prototype. Persisted to localStorage; media blobs
 * live in IndexedDB (lib/state/media-store.ts). ONLY lib/services/mock/* and the Demo Panel's
 * demo actions (lib/demo/actions.ts) may write to it. Screens must go through services.
 *
 * Production equivalent: Postgres tables units, contents, media, reveal_events, audit_log,
 * batches, admin_users (docs/ARCHITECTURE.md).
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AdminSession,
  AuditEntry,
  Batch,
  ContentMap,
  EmailMessage,
  MediaRecord,
  RevealEvent,
  Unit,
} from "@/lib/services/types";

export interface DbState {
  schema: 1;
  seeded: boolean;
  units: Record<string, Unit>;
  /** Keyed by unit id. */
  contents: Record<string, ContentMap>;
  media: Record<string, MediaRecord>;
  reveals: RevealEvent[];
  audit: AuditEntry[];
  outbox: EmailMessage[];
  batches: Batch[];
  /** Timestamps (ms) of failed claim attempts, for the simulated rate limiter. */
  claimFailures: number[];
  admin: AdminSession | null;
}

export const emptyDb = (): DbState => ({
  schema: 1,
  seeded: false,
  units: {},
  contents: {},
  media: {},
  reveals: [],
  audit: [],
  outbox: [],
  batches: [],
  claimFailures: [],
  admin: null,
});

export const DB_STORAGE_KEY = "saudade-mock-db-v2";

export const useDb = create<DbState>()(
  persist(() => emptyDb(), {
    name: DB_STORAGE_KEY,
    version: 1,
    storage: createJSONStorage(() => localStorage),
  }),
);

/** Resolves once the persisted state has been read from localStorage (client only). */
export function dbHydrated(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (useDb.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useDb.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

/** Keep other tabs in sync (sender editing in one tab, recipient view in another). */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DB_STORAGE_KEY) void useDb.persist.rehydrate();
  });
}
