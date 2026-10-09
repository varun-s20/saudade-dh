/**
 * Per-device preferences and memory for the recipient (no accounts, so this is device-local
 * in production too): when this device last viewed each envelope (drives the "new" postmark)
 * and whether reveal sounds are muted.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DeviceState {
  /** slug → ISO timestamp of this device's last completed visit. */
  lastVisit: Record<string, string>;
  soundMuted: boolean;
  markVisited: (slug: string, at: string) => void;
  forget: (slug: string) => void;
  setSoundMuted: (v: boolean) => void;
}

export const useDevice = create<DeviceState>()(
  persist(
    (set) => ({
      lastVisit: {},
      soundMuted: false,
      markVisited: (slug, at) => set((s) => ({ lastVisit: { ...s.lastVisit, [slug]: at } })),
      forget: (slug) =>
        set((s) => {
          const next = { ...s.lastVisit };
          delete next[slug];
          return { lastVisit: next };
        }),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
    }),
    { name: "saudade-device-v1", storage: createJSONStorage(() => localStorage) },
  ),
);
