"use client";

/**
 * Photos world (snapshot / album, terracotta): a little pile of prints on an album page.
 *
 * - The top print can be swiped away (pointer drag, 1:1, spring settle); the previous one comes
 *   back on top when swiped the other way. Visible Previous / Next buttons and ← / → keys do the
 *   same (WCAG 2.5.7), with "3 of 6". The pile loops, so it never runs out under your thumb.
 * - Tap a print to look closer: <PhotoViewer> (pinch-zoom, pan, double-tap, its caption).
 * - The caption is handwritten under the pile; real alt text on every image.
 * - Only the top three prints are in the DOM; the first loads eagerly, the rest lazily, and the
 *   neighbours are preloaded so a swipe never shows an empty print.
 * - Reduced motion: prints crossfade in place (a drag still follows the finger).
 */
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { PhotoItem, PhotosContent } from "@/lib/services/types";
import { PhotoMount } from "@/components/media/PhotoMount";
import { useElementSize } from "@/components/envelope/useElementSize";
import { IconChevronRight } from "@/components/ui/icons";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { ease } from "@/lib/tokens";
import type { AccentToken } from "@/config/stamps";
import { PhotoViewer } from "./PhotoViewer";
import { useMediaUrls } from "./useMediaUrl";
import "./worlds.css";

export interface PhotosWorldProps {
  photos: PhotosContent;
  fromName?: string | null;
}

/** Each print's own slight tilt on the page (cycled), so the pile looks placed by hand. */
const TILT = [-2.2, 1.7, -1.1, 2.5, -1.8, 1.2, -2.7, 2.1, -0.9, 1.5, -2.3, 2.8, -1.4, 1.0, -2.5];
/** Where the prints underneath sit, relative to the top one. */
const PILE = [
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: 11, y: 9, rotate: 4.5, scale: 0.965 },
  { x: -10, y: 15, rotate: -5, scale: 0.935 },
] as const;
/** PhotoMount geometry (photo-mount.css): the image window is 90.8% of the print's width and the
 * border adds 10% of the width to its height. Used to fit a print inside the stage. */
const WINDOW = 0.908;
const BORDER = 0.1;
const SWIPE_DISTANCE = 72;
const SWIPE_SPEED = 480;
const TAPE: AccentToken[] = ["rose", "ochre", "dusty-blue"];

const tiltOf = (i: number) => TILT[i % TILT.length];
const altOf = (item: PhotoItem, i: number, n: number) => item.alt?.trim() || item.caption?.trim() || `Photo ${i + 1} of ${n}`;

function printWidth(stage: { width: number; height: number }, item: PhotoItem): number {
  const aspect = item.width > 0 && item.height > 0 ? item.width / item.height : 4 / 3;
  const byWidth = stage.width * 0.8;
  const byHeight = (stage.height * 0.86) / (WINDOW / aspect + BORDER);
  return Math.max(120, Math.floor(Math.min(byWidth, byHeight, 34 * 16)));
}

export function PhotosWorld({ photos, fromName }: PhotosWorldProps) {
  const items = photos.items;
  const n = items.length;
  const reduced = useReducedMotionPref();
  const hydrated = useHydrated();
  const urls = useMediaUrls(items.map((i) => i.mediaId));
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);
  const captionId = useId();
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);
  const [viewer, setViewer] = useState(false);

  // Activity (README rule 4): never come back to an open full-screen photo.
  useLayoutEffect(() => () => setViewer(false), []);

  const go = (delta: number) => {
    if (n < 2) return;
    setPage(([i]) => [(i + delta + n) % n, delta]);
  };

  // Preload the neighbours so a swipe never lands on a blank print.
  useEffect(() => {
    if (n < 2) return;
    for (const d of [1, -1, 2]) {
      const it = items[(index + d + n) % n];
      const url = it ? urls[it.mediaId] : null;
      if (url) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    }
  }, [index, items, n, urls]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  if (n === 0) {
    return <p className="px-6 py-10 text-center text-lg font-medium text-ink-soft">The photos aren&apos;t here any more.</p>;
  }

  const current = items[index];
  const currentUrl = urls[current.mediaId];
  const under = [2, 1].filter((d) => d < n).map((d) => ({ depth: d, i: (index + d) % n }));
  const position = `Photo ${index + 1} of ${n}`;

  return (
    <div className="wd-photos flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]" onKeyDown={onKeyDown} data-world="photos">
      <div
        ref={stageRef}
        role="group"
        aria-label={`${n === 1 ? "One photo" : `${n} photos`}${fromName ? ` from ${fromName}` : ""}`}
        className="relative min-h-[18rem] flex-1 overflow-x-clip"
      >
        {stage.width > 0
          ? under.map(({ depth, i }) => {
              const item = items[i];
              const p = PILE[depth];
              return (
                <div key={`${item.id}-under`} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: p.x, y: p.y, rotate: tiltOf(i) + p.rotate, scale: p.scale }}
                    transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 30, opacity: { duration: 0.25 } }}
                    style={{ width: printWidth(stage, item) }}
                  >
                    <Print item={item} url={urls[item.mediaId]} alt="" i={i} />
                  </motion.div>
                </div>
              );
            })
          : null}

        {stage.width > 0 ? (
          <AnimatePresence initial={false} custom={dir}>
            <TopPrint
              key={current.id}
              item={current}
              i={index}
              url={currentUrl}
              alt={altOf(current, index, n)}
              label={`Look closer at photo ${index + 1} of ${n}: ${altOf(current, index, n)}`}
              captionId={current.caption ? captionId : undefined}
              width={printWidth(stage, current)}
              stageWidth={stage.width}
              dir={dir}
              reduced={reduced}
              canSwipe={n > 1}
              onSwipe={go}
              onOpen={() => setViewer(true)}
            />
          </AnimatePresence>
        ) : null}
      </div>

      {/* Handwritten caption under the pile (reserved height: no jump between photos). */}
      <div className="wd-photos__caption-box flex items-start justify-center px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={current.id}
            id={captionId}
            className="wd-photos__caption max-w-[26rem] text-center font-hand text-ink-letter"
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: ease.out }}
          >
            {current.caption ?? ""}
          </motion.p>
        </AnimatePresence>
      </div>

      {n > 1 ? (
        <div className="flex items-center justify-center gap-6 pt-1 pb-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="wd-round-btn tap-target" data-photos-prev>
            <IconChevronRight size={22} className="-scale-x-100" />
          </button>
          <p className="postal-label min-w-[5.5rem] text-center text-terracotta-ink tabular-nums" aria-hidden>
            {index + 1} of {n}
          </p>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="wd-round-btn tap-target" data-photos-next>
            <IconChevronRight size={22} />
          </button>
        </div>
      ) : null}
      <p className="px-6 pb-6 text-center text-[0.95rem] font-medium text-ink-faded">
        {n > 1 ? "Swipe through them, or tap one to look closer." : "Tap the photo to look closer."}
      </p>

      {/* Polite announcement of the photo in view (only after the recipient moves). */}
      <p className="sr-only" role="status" aria-live="polite">
        {dir !== 0 ? position : ""}
      </p>

      {hydrated
        ? createPortal(
            <AnimatePresence>
              {viewer && currentUrl ? (
                <PhotoViewer
                  key={current.id}
                  src={currentUrl}
                  alt={altOf(current, index, n)}
                  caption={current.caption}
                  width={current.width}
                  height={current.height}
                  position={position}
                  onClose={() => setViewer(false)}
                />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}

/** A print: PhotoMount once the URL is known, an empty print of the same size until then. */
function Print({ item, url, alt, i, priority }: { item: PhotoItem; url: string | null | undefined; alt: string; i: number; priority?: boolean }) {
  if (!url) {
    return (
      <div className="wd-print-blank" aria-hidden>
        <div style={{ aspectRatio: `${item.width} / ${item.height}` }} />
      </div>
    );
  }
  // Album corners on most prints, washi tape on every third, so the pile isn't uniform.
  const taped = i % 3 === 2;
  return (
    <PhotoMount
      src={url}
      alt={alt}
      width={item.width}
      height={item.height}
      priority={priority}
      corners={!taped}
      tape={taped ? TAPE[i % TAPE.length] : undefined}
    />
  );
}

interface TopPrintProps {
  item: PhotoItem;
  i: number;
  url: string | null | undefined;
  alt: string;
  label: string;
  captionId?: string;
  width: number;
  stageWidth: number;
  dir: number;
  reduced: boolean;
  canSwipe: boolean;
  onSwipe: (delta: number) => void;
  onOpen: () => void;
}

/** The print on top: draggable sideways, tappable to look closer. */
function TopPrint({ item, i, url, alt, label, captionId, width, stageWidth, dir, reduced, canSwipe, onSwipe, onOpen }: TopPrintProps) {
  const dragX = useMotionValue(0);
  const dragTilt = useTransform(dragX, [-260, 0, 260], [-8, 0, 8]);
  const lastDragEnd = useRef(0);
  const tilt = tiltOf(i);
  const under = PILE[1];

  // Variants take the direction of travel: +1 = next (top print tossed left, the next rises from
  // the pile), -1 = previous (it comes back from the left, on top; the old one returns to the pile).
  const variants = {
    enter: (d: number) =>
      reduced
        ? { opacity: 0, x: 0, y: 0, rotate: tilt, scale: 1 }
        : d >= 0
          ? { opacity: 1, x: under.x, y: under.y, rotate: tilt + under.rotate, scale: under.scale }
          : { opacity: 0, x: -stageWidth * 0.95, y: 10, rotate: tilt - 12, scale: 1 },
    center: { opacity: 1, x: 0, y: 0, rotate: tilt, scale: 1, zIndex: 2 },
    exit: (d: number) =>
      reduced
        ? { opacity: 0, zIndex: 1 }
        : d >= 0
          ? {
              opacity: 0,
              x: -stageWidth * 1.05,
              y: 26,
              rotate: tilt - 16,
              zIndex: 3,
              transition: { duration: 0.42, ease: ease.out, opacity: { duration: 0.18, delay: 0.24 } },
            }
          : { opacity: 0, x: under.x, y: under.y, rotate: tilt + under.rotate, scale: under.scale, zIndex: 1, transition: { duration: 0.3, ease: ease.out } },
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    lastDragEnd.current = performance.now();
    const next = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_SPEED;
    const prev = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_SPEED;
    // A "next" swipe keeps its offset: the print carries on off the page from where it was let go.
    if (!next) animate(dragX, 0, reduced ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 34 });
    if (next) onSwipe(1);
    else if (prev) onSwipe(-1);
  };

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.div
        className="pointer-events-auto"
        custom={dir}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 280, damping: 30, opacity: { duration: 0.2 } }}
        style={{ width }}
        data-photo-top={item.id}
      >
        <motion.div
          drag={canSwipe ? "x" : false}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          style={{ x: dragX, rotate: reduced ? 0 : dragTilt, touchAction: "pan-y" }}
          className={canSwipe ? "cursor-grab active:cursor-grabbing" : undefined}
        >
          <button
            type="button"
            className="wd-print-btn block w-full text-left"
            aria-label={label}
            aria-describedby={captionId}
            onClick={() => {
              if (performance.now() - lastDragEnd.current < 250) return;
              onOpen();
            }}
            data-photo-open
          >
            <Print item={item} url={url} alt={alt} i={i} priority={i === 0} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
