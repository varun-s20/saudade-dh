"use client";

/** A direction's palette as overlapping paint chips; hex values are read live from the tokens. */
import { useSyncExternalStore } from "react";

export interface PaletteChip {
  /** Token name without "--", or a CSS colour expression in `css`. */
  token: string;
  name: string;
  role: string;
  /** Optional CSS value when the chip is a mix of tokens (e.g. kraft). */
  css?: string;
}

const snapshots = new Map<string, Record<string, string>>();
const noop = () => () => {};

function snapshot(tokens: string[]): Record<string, string> {
  const key = tokens.join("|");
  const hit = snapshots.get(key);
  if (hit) return hit;
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const t of tokens) out[t] = cs.getPropertyValue(`--${t}`).trim();
  snapshots.set(key, out);
  return out;
}

export function Palette({ chips }: { chips: PaletteChip[] }) {
  const values = useSyncExternalStore(
    noop,
    () => snapshot(chips.map((c) => c.token)),
    () => null,
  );
  return (
    <ul className="grid grid-cols-1 gap-x-5 gap-y-4 min-[440px]:grid-cols-2" role="list">
      {chips.map((c) => {
        const v = values?.[c.token];
        return (
          <li key={c.name} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 size-11 flex-none rounded-paper shadow-stamp"
              style={{ backgroundColor: c.css ?? `var(--${c.token})`, backgroundImage: "var(--texture-grain)" }}
            />
            <span className="min-w-0">
              <span className="block font-display text-[0.9375rem] leading-tight text-ink">{c.name}</span>
              <span className="block font-postal text-[0.6875rem] tracking-[0.04em] [overflow-wrap:anywhere] text-ink-faded">
                {c.css ? "mix of paper-edge + paper-deep" : `--${c.token}`}
                {!c.css && v && /^#/.test(v) ? <span className="text-ink-soft"> · {v}</span> : null}
              </span>
              <span className="block text-[0.75rem] leading-snug text-ink-soft">{c.role}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
