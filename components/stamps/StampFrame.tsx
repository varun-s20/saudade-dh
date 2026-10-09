"use client";

/**
 * <StampFrame>: the physical stamp around any artwork: gummed paper margin, perforated edge
 * (CSS mask, see stamps.css), a drop shadow that follows the perforations, and optional
 * rotation. Content (client artwork via config/stamps.ts) goes in `children`.
 *
 * Geometry scales with `width`: hole radius ≈ 3% of the width (2.4–5.5px), pitch = 2.75 × hole.
 */
import type { CSSProperties, ReactNode } from "react";
import { PLACEHOLDER_LABEL, accentVar, type AccentToken } from "@/config/stamps";
import { cn } from "@/lib/utils/cn";
import "./stamps.css";

export interface StampFrameProps {
  children: ReactNode;
  /** Width in px of the whole stamp including perforations. Omit to fill the parent. */
  width?: number;
  /** Tints the hairline inside the paper margin. */
  accent?: AccentToken;
  rotate?: number;
  /** Perforation hole radius in px. */
  perforation?: number;
  shadow?: boolean;
  /** Show the "PLACEHOLDER — client artwork pending" marking. */
  placeholder?: boolean;
  className?: string;
  /** Paper margin between the perforation line and the artwork, px. Default: hole radius + 3.5% of width. */
  margin?: number;
  style?: CSSProperties;
}

/** Perforation geometry for a stamp of a given width. Exported so overlays can align to it. */
export function stampGeometry(width?: number, perforation?: number, margin?: number) {
  const w = width ?? 132;
  const hole = perforation ?? Math.min(5.5, Math.max(2.4, w * 0.03));
  const pitch = hole * 2.75;
  const m = margin ?? hole + Math.max(3, w * 0.035);
  return { hole, pitch, margin: m, padding: pitch / 2 + m };
}

export function StampFrame({
  children,
  width,
  accent,
  rotate = 0,
  perforation,
  shadow = true,
  placeholder,
  className,
  margin,
  style,
}: StampFrameProps) {
  const g = stampGeometry(width, perforation, margin);
  // Visible margin = margin − hole depth. Only print the mark where it fits clear of the holes;
  // the placeholder artwork carries its own printed mark at every size.
  const clear = g.margin - g.hole;
  const markSize = Math.min(9, clear * 0.8);
  const showMark = placeholder && markSize >= 5.5;

  return (
    <div
      className={cn("sd-stamp", shadow && "sd-stamp--shadow", className)}
      style={{
        width: width ?? "100%",
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...style,
      }}
      data-placeholder={placeholder || undefined}
      title={placeholder ? PLACEHOLDER_LABEL : undefined}
    >
      <div
        className="sd-stamp__perf"
        style={
          {
            "--hole": `${g.hole}px`,
            "--pitch": `${g.pitch}px`,
            padding: g.padding,
            ...(accent ? { "--stamp-accent": accentVar(accent) } : null),
          } as CSSProperties
        }
      >
        {children}
        {showMark && (
          <span className="sd-stamp__mark" style={{ fontSize: markSize, bottom: g.pitch / 2 + g.hole + (clear - markSize) / 2 }}>
            Placeholder
          </span>
        )}
      </div>
    </div>
  );
}
