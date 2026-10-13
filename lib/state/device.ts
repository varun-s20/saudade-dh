/**
 * Per-device preferences and memory for the recipient (no accounts, so this is device-local
 * in production too): when this device last viewed each envelope (drives the "new" postmark),
 * which version of each letter it has already watched being written (D-082: the letter types itself
 * out once, then simply reads), and whether reveal sounds are muted.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DeviceState {
  /** slug → ISO timestamp of this device's last completed visit. */
  lastVisit: Record<string, string>;
  /** slug → the letter version (its updatedAt) this device has watched being written. */
  lettersRead: Record<string, string>;
  soundMuted: boolean;
  markVisited: (slug: string, at: string) => void;
  markLetterRead: (slug: string, version: string) => void;
  forget: (slug: string) => void;
  setSoundMuted: (v: boolean) => void;
}

export const useDevice = create<DeviceState>()(
  persist(
    (set) => ({
      lastVisit: {},
      lettersRead: {},
      soundMuted: false,
      markVisited: (slug, at) => set((s) => ({ lastVisit: { ...s.lastVisit, [slug]: at } })),
      markLetterRead: (slug, version) => set((s) => ({ lettersRead: { ...s.lettersRead, [slug]: version } })),
      forget: (slug) =>
        set((s) => {
          const lastVisit = { ...s.lastVisit };
          const lettersRead = { ...s.lettersRead };
          delete lastVisit[slug];
          delete lettersRead[slug];
          return { lastVisit, lettersRead };
        }),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
    }),
    { name: "saudade-device-v1", storage: createJSONStorage(() => localStorage) },
  ),
);
