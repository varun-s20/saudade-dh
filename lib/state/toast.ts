/**
 * Toast queue. Call `toast(...)` from anywhere; <Toaster/> (components/ui/Toaster.tsx) renders it.
 * Copy voice: warm, brief, human. Errors are plain and clear (no postal metaphors).
 */
import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "error";

export interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  /** ms; errors stay a little longer by default. */
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "duration" | "tone"> & Partial<Pick<ToastItem, "duration" | "tone">>) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set) => ({
  items: [],
  push: (t) => {
    const id = nextId++;
    const tone = t.tone ?? "neutral";
    const item: ToastItem = { id, tone, duration: t.duration ?? (tone === "error" ? 6000 : 3200), title: t.title, body: t.body };
    set((s) => ({ items: [...s.items.slice(-2), item] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = (title: string, opts: { body?: string; tone?: ToastTone; duration?: number } = {}) =>
  useToasts.getState().push({ title, ...opts });
