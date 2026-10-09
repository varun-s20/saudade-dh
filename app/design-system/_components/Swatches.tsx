"use client";

/**
 * Colour swatches as little perforated stamps. Hex values and WCAG contrast ratios are read
 * live from the CSS custom properties (styles/tokens.css), so this page can't drift from them.
 */
import { useSyncExternalStore } from "react";
import { StampFrame } from "@/components/stamps/StampFrame";
import { SubHead } from "./ds";

type Pair = [fg: string, bg: string];
interface Swatch {
  token: string;
  name: string;
  use: string;
  /** Contrast pairs to report (token names without "--"). */
  pairs?: Pair[];
}

const GROUPS: Array<{ title: string; note?: string; swatches: Swatch[] }> = [
  {
    title: "Paper",
    note: "Surfaces. Ratios show body ink on each.",
    swatches: [
      { token: "paper", name: "Paper", use: "Page background, cream", pairs: [["ink", "paper"]] },
      { token: "paper-raised", name: "Paper raised", use: "Letter sheet, cards, stamp margins", pairs: [["ink", "paper-raised"]] },
      { token: "paper-deep", name: "Paper deep", use: "Envelope body", pairs: [["ink", "paper-deep"]] },
      { token: "paper-shadow", name: "Paper shadow", use: "Folds, hairlines", pairs: [["ink", "paper-shadow"]] },
      { token: "paper-edge", name: "Paper edge", use: "Deckles, borders on paper" },
      { token: "paper-liner", name: "Liner", use: "Envelope liner (rose-tinted)", pairs: [["ink", "paper-liner"]] },
      { token: "desk", name: "Desk", use: "Desktop surround", pairs: [["ink", "desk"]] },
    ],
  },
  {
    title: "Ink",
    note: "Text colours, measured on paper.",
    swatches: [
      { token: "ink", name: "Ink", use: "Body text", pairs: [["ink", "paper"], ["ink", "paper-raised"]] },
      { token: "ink-soft", name: "Ink soft", use: "Secondary text", pairs: [["ink-soft", "paper"]] },
      { token: "ink-faded", name: "Ink faded", use: "Captions, meta", pairs: [["ink-faded", "paper"], ["ink-faded", "paper-raised"]] },
      { token: "ink-letter", name: "Letter ink", use: "Fountain-pen blue-black for the letter", pairs: [["ink-letter", "paper-raised"]] },
      { token: "ink-inverse", name: "Ink inverse", use: "Text on ink and terracotta", pairs: [["ink-inverse", "accent-terracotta-ink"]] },
    ],
  },
  {
    title: "Postal",
    swatches: [
      { token: "postmark", name: "Postmark", use: "Cancellation ink, focus-adjacent", pairs: [["postmark", "paper"]] },
      { token: "focus-ring", name: "Focus ring", use: "Visible focus (non-text, ≥ 3:1)", pairs: [["focus-ring", "paper"]] },
    ],
  },
  {
    title: "Sun-bleached accents",
    note: "Each accent has a fill (decorative) and an “-ink” partner that is safe for text.",
    swatches: [
      { token: "accent-terracotta", name: "Terracotta", use: "Photos world · fill" },
      { token: "accent-terracotta-ink", name: "Terracotta ink", use: "Primary buttons, text", pairs: [["accent-terracotta-ink", "paper"]] },
      { token: "accent-dusty-blue", name: "Dusty blue", use: "Letter world · fill" },
      { token: "accent-dusty-blue-ink", name: "Dusty blue ink", use: "Text", pairs: [["accent-dusty-blue-ink", "paper"]] },
      { token: "accent-sage", name: "Sage", use: "Voice world · fill" },
      { token: "accent-sage-ink", name: "Sage ink", use: "Text, success", pairs: [["accent-sage-ink", "paper"]] },
      { token: "accent-ochre", name: "Ochre", use: "Song world · fill" },
      { token: "accent-ochre-ink", name: "Ochre ink", use: "Hints; large text on deep paper", pairs: [["accent-ochre-ink", "paper"], ["accent-ochre-ink", "paper-deep"]] },
      { token: "accent-rose", name: "Rose", use: "Liner, selection, tape" },
      { token: "accent-rose-ink", name: "Rose ink", use: "Text", pairs: [["accent-rose-ink", "paper"]] },
      { token: "accent-red", name: "Postal red", use: "NEW marks, airmail" },
      { token: "accent-red-ink", name: "Red ink", use: "Text", pairs: [["accent-red-ink", "paper"]] },
    ],
  },
  {
    title: "Feedback",
    swatches: [
      { token: "success", name: "Success", use: "Saved, sealed", pairs: [["success", "paper"]] },
      { token: "danger", name: "Danger", use: "Errors, remove", pairs: [["danger", "paper"], ["ink-inverse", "danger"]] },
      { token: "warning", name: "Warning", use: "Gentle hints", pairs: [["warning", "paper"]] },
    ],
  },
  {
    title: "Materials",
    swatches: [
      { token: "wax", name: "Wax", use: "Heart seal body" },
      { token: "wax-highlight", name: "Wax highlight", use: "Seal light" },
      { token: "wax-shadow", name: "Wax shadow", use: "Seal depth" },
      { token: "vinyl", name: "Vinyl", use: "Record" },
      { token: "vinyl-groove", name: "Groove", use: "Record grooves" },
    ],
  },
  {
    title: "Admin",
    note: "Calmer and utilitarian, still paper-toned.",
    swatches: [
      { token: "admin-bg", name: "Admin bg", use: "Page" },
      { token: "admin-surface", name: "Admin surface", use: "Tables, panels", pairs: [["admin-ink", "admin-surface"]] },
      { token: "admin-line", name: "Admin line", use: "Rules" },
      { token: "admin-ink", name: "Admin ink", use: "Text", pairs: [["admin-ink", "admin-surface"]] },
      { token: "admin-ink-soft", name: "Admin ink soft", use: "Secondary", pairs: [["admin-ink-soft", "admin-surface"]] },
    ],
  },
];

// ── Live token reading (client only, cached; server snapshot = null) ─────────────
let cache: Map<string, string> | null = null;
function readTokens(): Map<string, string> {
  if (cache) return cache;
  const cs = getComputedStyle(document.documentElement);
  const m = new Map<string, string>();
  for (const g of GROUPS)
    for (const s of g.swatches) {
      m.set(s.token, cs.getPropertyValue(`--${s.token}`).trim());
      for (const [fg, bg] of s.pairs ?? []) {
        m.set(fg, cs.getPropertyValue(`--${fg}`).trim());
        m.set(bg, cs.getPropertyValue(`--${bg}`).trim());
      }
    }
  cache = m;
  return m;
}
const noop = () => () => {};
function useTokens() {
  return useSyncExternalStore(noop, readTokens, () => null);
}

function parse(c: string | undefined): [number, number, number] | null {
  if (!c) return null;
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}
function lum([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a: string | undefined, b: string | undefined): number | null {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}
const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large · UI" : "decorative only");

function SwatchStamp({ s, tokens }: { s: Swatch; tokens: Map<string, string> | null }) {
  const value = tokens?.get(s.token);
  return (
    <li className="flex min-w-0 flex-col gap-2.5">
      <StampFrame width={92} shadow className="self-start">
        <div className="ds-chip" style={{ backgroundColor: `var(--${s.token})` }} />
      </StampFrame>
      <div className="min-w-0">
        <p className="font-display text-[0.9375rem] leading-tight text-ink">{s.name}</p>
        <p className="mt-0.5 font-postal text-[0.6875rem] tracking-[0.04em] break-all text-ink-faded">--{s.token}</p>
        <p className="font-postal text-[0.6875rem] tracking-[0.04em] text-ink-soft">{value && /^#|^rgb/.test(value) ? value : " "}</p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">{s.use}</p>
        {s.pairs?.map(([fg, bg]) => {
          const r = ratio(tokens?.get(fg), tokens?.get(bg));
          return (
            <p key={`${fg}-${bg}`} className="mt-1 text-[0.75rem] leading-snug text-ink-faded">
              {fg === s.token ? `on ${bg}` : `${fg} on it`}: <strong className="font-semibold text-ink-soft">{r ? `${r.toFixed(1)}:1` : "…"}</strong>
              {r ? ` · ${grade(r)}` : ""}
            </p>
          );
        })}
      </div>
    </li>
  );
}

export function Swatches() {
  const tokens = useTokens();
  return (
    <div>
      {GROUPS.map((g, i) => (
        <div key={g.title} className={i ? "mt-14" : undefined}>
          <SubHead note={g.note}>{g.title}</SubHead>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="list">
            {g.swatches.map((s) => (
              <SwatchStamp key={s.token} s={s} tokens={tokens} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
