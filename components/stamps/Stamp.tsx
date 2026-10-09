"use client";

/**
 * <Stamp>: one of the four content stamps (art from config/stamps.ts only), in its frame.
 * - `empty`: dashed slot for the sender portal ("nothing added yet").
 * - `postmark`: a cancellation lands partly over the stamp's top-right corner.
 * - `isNew`: a small red "NEW" mark at the bottom-left corner.
 *
 * Purely visual (aria-hidden). Screens wrap it in a real <button> with STAMPS[kind].recipient.openLabel.
 * Rotation is applied to the whole group so the postmark keeps its place on the corner.
 */
import type { CSSProperties, ReactNode } from "react";
import type { StampKind } from "@/lib/services/types";
import { STAMPS } from "@/config/stamps";
import { cn } from "@/lib/utils/cn";
import { Postmark } from "@/components/paper/Postmark";
import { StampFrame, stampGeometry } from "./StampFrame";
import "./stamps.css";

export interface StampPostmarkOptions {
  /** ISO date (or preformatted "08 OCT 2026") printed in the ring. */
  date?: string;
  /** Default "wavy" (ring + cancellation lines crossing the stamp). */
  variant?: "circle" | "wavy";
  /** Override the arc text. Default STAMPS[kind].postmark. */
  place?: string;
}

export interface StampProps {
  kind: StampKind;
  /** Rendered width in px (height follows the artwork aspect + perforation margin). Default 132. */
  width?: number;
  /** Degrees. Defaults to the resting rotation in config/stamps.ts `place.rotate`. */
  rotate?: number;
  /** Show a cancellation postmark over the stamp. Pass a date (ISO) to print it. */
  postmark?: boolean | StampPostmarkOptions;
  /** Small "new" postmark for stamps updated since the last visit ([PROPOSED]). */
  isNew?: boolean;
  /** Sender portal: dashed outline slot with no artwork (nothing added yet). */
  empty?: boolean;
  className?: string;
  /** Drop shadow under the stamp. Default true. */
  shadow?: boolean;
  /** Content of the empty slot. Default: the stamp's label in postal type. */
  emptyLabel?: ReactNode;
  /** Load the artwork eagerly (above the fold, e.g. the envelope on first paint). */
  priority?: boolean;
  style?: CSSProperties;
}

/** Total rendered height of a stamp of `width` px, for layout maths (envelope placement). */
export function stampHeight(kind: StampKind, width = 132): number {
  const { art } = STAMPS[kind];
  const { padding } = stampGeometry(width);
  return (width - padding * 2) * (art.height / art.width) + padding * 2;
}

export function Stamp({
  kind,
  width = 132,
  rotate,
  postmark,
  isNew,
  empty,
  className,
  shadow = true,
  emptyLabel,
  priority,
  style,
}: StampProps) {
  const def = STAMPS[kind];
  const deg = rotate ?? def.place.rotate;
  const height = stampHeight(kind, width);
  const pm: StampPostmarkOptions | null = postmark ? (postmark === true ? {} : postmark) : null;

  // Cancellation: ring centred near the top-right corner, partly off the stamp.
  const ring = width * 0.64;
  const wavy = (pm?.variant ?? "wavy") === "wavy";
  const pmWidth = wavy ? ring * 2 : ring;
  const ringCx = width * 0.86;
  const ringCy = height * 0.19;

  const newSize = Math.max(40, width * 0.36);

  return (
    <div
      className={cn("relative inline-block align-top", className)}
      style={{ width, height, transform: deg ? `rotate(${deg}deg)` : undefined, ...style }}
      aria-hidden
      data-stamp={kind}
    >
      {empty ? (
        <div className={cn("sd-stamp-empty", "postal-label px-2 text-center")} style={{ width, height }}>
          {emptyLabel ?? def.label}
        </div>
      ) : (
        <StampFrame width={width} accent={def.accent} placeholder={def.art.placeholder} shadow={shadow}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art from the asset map; next/image adds nothing here */}
          <img
            src={def.art.src}
            alt=""
            width={def.art.width}
            height={def.art.height}
            className="sd-stamp__art"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        </StampFrame>
      )}

      {pm && !empty && (
        <Postmark
          className="sd-overlay"
          style={{ left: ringCx + ring / 2 - pmWidth, top: ringCy - ring / 2 }}
          variant={wavy ? "wavy" : "circle"}
          wavySide="left"
          size={ring}
          rotate={wavy ? -5 : -9}
          place={pm.place ?? def.postmark}
          bottom="SAUDADE"
          date={pm.date}
        />
      )}

      {isNew && !empty && (
        <Postmark
          className="sd-overlay"
          style={{ left: -newSize * 0.28, top: height - newSize * 0.78 }}
          variant="new"
          size={newSize}
          rotate={10}
          place="SAUDADE"
          ink="red"
        />
      )}
    </div>
  );
}
