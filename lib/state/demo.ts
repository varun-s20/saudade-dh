/**
 * Demo Panel state (presenter controls). Persisted so it survives the full-page navigations the
 * panel uses to simulate an NFC tap. Services read `forced` errors from here; nothing in the
 * production build should depend on this store being enabled.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DemoErrorKey =
  | "invalid_code"
  | "already_claimed"
  | "rate_limited"
  | "upload_failed"
  | "mic_denied"
  | "in_app_browser"
  | "network";

export const DEMO_ERROR_LABELS: Record<DemoErrorKey, string> = {
  invalid_code: "Invalid code",
  already_claimed: "Already claimed",
  rate_limited: "Rate limited",
  upload_failed: "Upload failed",
  mic_denied: "Mic denied",
  in_app_browser: "In-app browser",
  network: "Network error",
};

export type MotionOverride = "system" | "reduce" | "full";

interface DemoState {
  /** Panel is available (?demo=1, or triple-tap on the logo). */
  enabled: boolean;
  open: boolean;
  forced: Partial<Record<DemoErrorKey, boolean>>;
  motion: MotionOverride;
  /** Skip simulated latency (rehearsals). */
  fast: boolean;
  setEnabled: (v: boolean) => void;
  setOpen: (v: boolean) => void;
  toggleError: (k: DemoErrorKey) => void;
  clearErrors: () => void;
  setMotion: (m: MotionOverride) => void;
  setFast: (v: boolean) => void;
}

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      enabled: false,
      open: false,
      forced: {},
      motion: "system",
      fast: false,
      setEnabled: (enabled) => set({ enabled }),
      setOpen: (open) => set({ open }),
      toggleError: (k) => set((s) => ({ forced: { ...s.forced, [k]: !s.forced[k] } })),
      clearErrors: () => set({ forced: {} }),
      setMotion: (motion) => set({ motion }),
      setFast: (fast) => set({ fast }),
    }),
    { name: "saudade-demo-v1", storage: createJSONStorage(() => localStorage) },
  ),
);

/** Non-React read for services. */
export const isForced = (k: DemoErrorKey): boolean => Boolean(useDemo.getState().forced[k]);
