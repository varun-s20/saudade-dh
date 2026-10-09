"use client";

/**
 * <PaperSheet>: stationery surface. Fibre + grain texture, optional ruled lines aligned to the
 * handwritten line height (--rule-letter), optional margin line, raised (fresh) or aged tone,
 * and a clean, deckled or torn edge.
 *
 * Deckled/torn edges are a deterministic clip-path in px (so the edge looks the same at any
 * height); their shadow sits on a wrapper <div> so it follows the edge. `className` always goes
 * on the paper itself (padding, width…); use `wrapperClassName` to position a clipped sheet.
 */
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { r2, seeded } from "./seeded";
import "./paper.css";

export interface PaperSheetProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  as?: ElementType;
  children?: ReactNode;
  /** Faint ruled lines (letter writing surface). Lines are spaced one handwritten line apart. */
  ruled?: boolean;
  edge?: "clean" | "deckled" | "torn";
  tone?: "raised" | "aged";
  className?: string;
  /** A faint red margin line on the left. */
  margin?: boolean;
  /** Paper shadow. Default true. */
  shadow?: boolean;
  /** Classes for the shadow wrapper of a deckled/torn sheet (layout/positioning). */
  wrapperClassName?: string;
  /** Varies the deckle/tear. */
  seed?: number;
  style?: CSSProperties;
}

/** Deckled: all four edges softly irregular (≤ 2.4px). */
function deckle(seed: number): string {
  const rnd = seeded(seed);
  const j = (amp: number) => r2(0.3 + rnd() * amp);
  const pts: string[] = [];
  const nx = 56;
  const ny = 90;
  for (let i = 0; i <= nx; i++) pts.push(`${r2((i / nx) * 100)}% ${j(2.1)}px`);
  for (let i = 1; i < ny; i++) pts.push(`calc(100% - ${j(2.4)}px) ${r2((i / ny) * 100)}%`);
  for (let i = nx; i >= 0; i--) pts.push(`${r2((i / nx) * 100)}% calc(100% - ${j(2.1)}px)`);
  for (let i = ny - 1; i > 0; i--) pts.push(`${j(2.4)}px ${r2((i / ny) * 100)}%`);
  return `polygon(${pts.join(",")})`;
}

/** Torn: a clean top and sides, a ragged bottom with the odd deeper bite. */
function torn(seed: number): string {
  const rnd = seeded(seed + 101);
  const pts: string[] = ["0 0", "100% 0"];
  const n = 74;
  let prev = 4;
  for (let i = n; i >= 0; i--) {
    const target = 2 + rnd() * 6 + (rnd() < 0.14 ? 4 + rnd() * 3 : 0);
    prev = prev * 0.35 + target * 0.65;
    pts.push(`${r2((i / n) * 100)}% calc(100% - ${r2(prev)}px)`);
  }
  return `polygon(${pts.join(",")})`;
}

const CLIP_CACHE = new Map<string, string>();
function clipFor(edge: "deckled" | "torn", seed: number) {
  const key = `${edge}:${seed}`;
  let v = CLIP_CACHE.get(key);
  if (!v) {
    v = edge === "deckled" ? deckle(seed) : torn(seed);
    CLIP_CACHE.set(key, v);
  }
  return v;
}

export function PaperSheet({
  as: Tag = "div",
  children,
  ruled,
  edge = "clean",
  tone = "raised",
  className,
  margin,
  shadow = true,
  wrapperClassName,
  seed = 3,
  style,
  ...rest
}: PaperSheetProps) {
  const paper = (
    <Tag
      {...rest}
      className={cn(
        "sd-paper",
        edge === "clean" && "sd-paper--clean",
        shadow && "sd-paper--shadow",
        ruled && "sd-paper--ruled",
        margin && "sd-paper--margin",
        tone === "aged" && "sd-paper--aged",
        className,
      )}
      style={edge === "clean" ? style : { clipPath: clipFor(edge, seed), ...style }}
    >
      {children}
    </Tag>
  );

  if (edge === "clean") return paper;
  return <div className={cn("sd-paper-wrap", shadow && "sd-paper-wrap--shadow", wrapperClassName)}>{paper}</div>;
}
