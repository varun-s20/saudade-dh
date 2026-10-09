"use client";

/**
 * <PhotoMount>: a snapshot tucked into an album page: worn white print border, four corner
 * pockets (or washi tape), a slight rotation and the caption handwritten underneath.
 * Width follows the parent (set it with className); `width`/`height` are the image's intrinsic
 * size and reserve its aspect ratio (no layout shift). Plain <img>, so blob:/object URLs work.
 */
import type { CSSProperties, ReactEventHandler } from "react";
import { accentVar, type AccentToken } from "@/config/stamps";
import { cn } from "@/lib/utils/cn";
import "./photo-mount.css";

export interface PhotoMountProps {
  src: string;
  alt: string;
  /** Intrinsic pixel size of the image (aspect ratio). */
  width: number;
  height: number;
  /** Handwritten under the print. */
  caption?: string;
  /** Degrees. Default 0. */
  rotate?: number;
  className?: string;
  /** Above the fold: eager load + high fetch priority. */
  priority?: boolean;
  /** Album corner pockets. Default true. */
  corners?: boolean;
  /** A strip of washi tape across the top edge; `true` = rose, or an accent token name. */
  tape?: boolean | AccentToken;
  srcSet?: string;
  sizes?: string;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  style?: CSSProperties;
}

export function PhotoMount({
  src,
  alt,
  width,
  height,
  caption,
  rotate = 0,
  className,
  priority,
  corners = true,
  tape,
  srcSet,
  sizes,
  onLoad,
  style,
}: PhotoMountProps) {
  return (
    <figure className={cn("sd-photo", className)} style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}>
      <div className="sd-photo__mount">
        <div className="sd-photo__print">
          <div className="sd-photo__window" style={{ aspectRatio: `${width} / ${height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- must accept blob:/object URLs from the sender's device */}
            <img
              className="sd-photo__img"
              src={src}
              srcSet={srcSet}
              sizes={sizes}
              alt={alt}
              width={width}
              height={height}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              draggable={false}
              onLoad={onLoad}
            />
          </div>
        </div>
        {corners && (
          <>
            <span className="sd-photo__corner sd-photo__corner--tl" aria-hidden />
            <span className="sd-photo__corner sd-photo__corner--tr" aria-hidden />
            <span className="sd-photo__corner sd-photo__corner--br" aria-hidden />
            <span className="sd-photo__corner sd-photo__corner--bl" aria-hidden />
          </>
        )}
        {tape && (
          <span
            className="sd-photo__tape"
            aria-hidden
            style={tape === true ? undefined : ({ "--tape": accentVar(tape) } as CSSProperties)}
          />
        )}
      </div>
      {caption && <figcaption className="sd-photo__caption">{caption}</figcaption>}
    </figure>
  );
}
