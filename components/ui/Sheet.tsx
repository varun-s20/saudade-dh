"use client";

/**
 * <Sheet>: the container each stamp "world" opens into, and a generic bottom sheet.
 *
 *   variant="world" (default)  phone: full screen; sm+: a centred card (40rem)
 *   variant="sheet"            phone: bottom sheet (≤ 90svh, rounded top); sm+: centred card (34rem)
 *
 * Motion (MOTION_SPEC §6):
 * - With `originRect` (the tapped stamp), the paper grows out of the stamp (transform-only morph
 *   on a plain paper layer) and the content fades up once the paper is most of the way there.
 *   Closing by button / Esc / scrim shrinks it back onto the stamp.
 * - Without an origin: phone slides up on a critically damped spring; desktop fades/rises 16px.
 * - Phone: drag the header down to close (1:1 tracking, closes past 25% / 120px or a flick > 600 px/s,
 *   otherwise springs back). A drag-close continues downward instead of returning to the stamp.
 * - Reduced motion: 200 ms crossfades, no morph, no slide.
 *
 * A11y: role="dialog" + aria-modal + aria-labelledby (the title is always present, `hideTitle`
 * only hides it visually); focus moves into the dialog, Tab is trapped, Esc closes, focus returns
 * to the element that opened it (EnvelopeView focuses the stamp button on click for Safari).
 *
 * Activity (README rule 4): the body scroll lock is released in a layout-effect cleanup, so a
 * hidden route never leaves the page locked. Screens should also reset their own `open` state
 * in a useLayoutEffect cleanup when the route hides.
 */
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  usePresence,
  type AnimationPlaybackControls,
  type PanInfo,
} from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { accentInkVar, accentVar, type AccentToken } from "@/config/stamps";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { ease, spring } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";
import { IconClose } from "./icons";

export type SheetVariant = "sheet" | "world";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title (always announced; see `hideTitle`). */
  title: string;
  /** Hide the title visually (the world draws its own heading). */
  hideTitle?: boolean;
  /** Optional one-line description under the title (aria-describedby). */
  description?: string;
  /** Stamp accent: a thin band at the top and the title's ink. */
  accent?: AccentToken;
  children: ReactNode;
  /** The tapped stamp's rect: the sheet grows out of it and returns to it. */
  originRect?: DOMRect | null;
  variant?: SheetVariant;
  /** Pinned below the scrolling content (actions). */
  footer?: ReactNode;
  /** Element to focus on open. Default: the dialog itself. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Accessible label of the close button. Default "Close". */
  closeLabel?: string;
  /** Classes for the scrolling content area. */
  className?: string;
}

/** The postcard pairing: block capitals, with the last word written in the script hand. */
function paired(title: string): ReactNode {
  const i = title.lastIndexOf(" ");
  return i < 0 ? (
    title
  ) : (
    <>
      {title.slice(0, i)} <em>{title.slice(i + 1)}</em>
    </>
  );
}

export function Sheet(props: SheetProps) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(<AnimatePresence>{props.open ? <SheetPanel key="sheet" {...props} /> : null}</AnimatePresence>, document.body);
}

// ── internals ────────────────────────────────────────────────────────────────

const PHONE_QUERY = "(max-width: 639.98px)";
function subscribeMedia(cb: () => void) {
  const m = window.matchMedia(PHONE_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function useIsPhone() {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => true,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, audio[controls], video[controls], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

/** One scroll lock for any number of open sheets. */
let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;
function lockScroll() {
  if (lockCount++ > 0) return;
  const html = document.documentElement;
  const gap = window.innerWidth - html.clientWidth;
  saved = { overflow: html.style.overflow, paddingRight: document.body.style.paddingRight };
  html.style.overflow = "hidden";
  if (gap > 0) document.body.style.paddingRight = `${gap}px`;
}
function unlockScroll() {
  if (--lockCount > 0 || !saved) return;
  document.documentElement.style.overflow = saved.overflow;
  document.body.style.paddingRight = saved.paddingRight;
  saved = null;
}

function SheetPanel({
  onClose,
  title,
  hideTitle,
  description,
  accent,
  children,
  originRect,
  variant = "world",
  footer,
  initialFocus,
  closeLabel = "Close",
  className,
}: SheetProps) {
  const [isPresent, safeToRemove] = usePresence();
  const reduced = useReducedMotionPref();
  const isPhone = useIsPhone();
  const dragControls = useDragControls();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const closeReason = useRef<"dismiss" | "drag">("dismiss");
  const runs = useRef<AnimationPlaybackControls[]>([]);

  const scrim = useMotionValue(0);
  const panelY = useMotionValue(0);
  const panelOpacity = useMotionValue(1);
  const paperX = useMotionValue(0);
  const paperY = useMotionValue(0);
  const paperSX = useMotionValue(1);
  const paperSY = useMotionValue(1);
  const paperOpacity = useMotionValue(1);
  const content = useMotionValue(0);
  const contentY = useMotionValue(0);

  const play = (c: AnimationPlaybackControls) => {
    runs.current.push(c);
    return c;
  };
  const stopAll = () => {
    runs.current.forEach((r) => r.stop());
    runs.current = [];
  };

  /** Transform that maps the paper's final rect onto the origin rect. */
  const originTransform = () => {
    const paper = paperRef.current;
    if (!paper || !originRect) return null;
    const p = paper.getBoundingClientRect();
    if (!p.width || !p.height) return null;
    return {
      x: originRect.left + originRect.width / 2 - (p.left + p.width / 2),
      y: originRect.top + originRect.height / 2 - (p.top + p.height / 2),
      sx: originRect.width / p.width,
      sy: originRect.height / p.height,
    };
  };

  // Enter (before first paint) + focus + scroll lock. Cleanup releases the lock (Activity-safe).
  useLayoutEffect(() => {
    if (!returnTo.current) returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();
    stopAll();

    if (reduced) {
      panelOpacity.set(0);
      content.set(1);
      play(animate(panelOpacity, 1, { duration: 0.2, ease: ease.out }));
      play(animate(scrim, 1, { duration: 0.2, ease: ease.out }));
    } else {
      const o = originTransform();
      if (o) {
        paperX.set(o.x);
        paperY.set(o.y);
        paperSX.set(o.sx);
        paperSY.set(o.sy);
        paperOpacity.set(0);
        content.set(0);
        contentY.set(14);
        // The stamp shows through for the first instant, so the paper reads as coming out of it.
        play(animate(paperOpacity, 1, { duration: 0.14, ease: ease.out }));
        play(animate(paperX, 0, spring.morph));
        play(animate(paperY, 0, spring.morph));
        play(animate(paperSX, 1, spring.morph));
        play(animate(paperSY, 1, spring.morph));
        play(animate(content, 1, { delay: 0.16, duration: 0.3, ease: ease.out }));
        play(animate(contentY, 0, { delay: 0.16, duration: 0.42, ease: ease.out }));
      } else if (isPhone) {
        const h = panelRef.current?.offsetHeight ?? window.innerHeight;
        panelY.set(h);
        content.set(1);
        play(animate(panelY, 0, spring.sheet));
      } else {
        panelOpacity.set(0);
        panelY.set(16);
        content.set(1);
        play(animate(panelOpacity, 1, { duration: 0.24, ease: ease.out }));
        play(animate(panelY, 0, { duration: 0.32, ease: ease.out }));
      }
      play(animate(scrim, 1, { duration: 0.32, ease: ease.out }));
    }

    const target = initialFocus?.current ?? panelRef.current;
    target?.focus({ preventScroll: true });

    return () => {
      stopAll();
      unlockScroll();
    };
    // Mount-only: the enter animation plays once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit: run our own animation, then let AnimatePresence remove us and return focus.
  useEffect(() => {
    if (isPresent) return;
    stopAll();
    const done: Promise<unknown>[] = [];
    const add = (c: AnimationPlaybackControls) => done.push(play(c).finished);

    add(animate(scrim, 0, { duration: reduced ? 0.15 : 0.28, ease: ease.out }));
    if (reduced) {
      add(animate(panelOpacity, 0, { duration: 0.15, ease: ease.out }));
    } else if (closeReason.current === "drag") {
      const h = panelRef.current?.offsetHeight ?? window.innerHeight;
      add(animate(panelY, h, { duration: 0.26, ease: ease.press }));
    } else {
      const o = originTransform();
      if (o) {
        // Back onto the stamp: content first, then the paper folds back to the stamp's size.
        const t = { duration: 0.34, ease: ease.inOut };
        add(animate(content, 0, { duration: 0.12, ease: ease.out }));
        add(animate(paperX, o.x, t));
        add(animate(paperY, o.y - panelY.get(), t));
        add(animate(paperSX, o.sx, t));
        add(animate(paperSY, o.sy, t));
        add(animate(paperOpacity, 0, { delay: 0.24, duration: 0.12, ease: ease.out }));
      } else if (isPhone) {
        const h = panelRef.current?.offsetHeight ?? window.innerHeight;
        add(animate(panelY, h, { duration: 0.26, ease: ease.press }));
      } else {
        add(animate(panelOpacity, 0, { duration: 0.18, ease: ease.out }));
        add(animate(panelY, 12, { duration: 0.18, ease: ease.out }));
      }
    }

    Promise.all(done).then(
      () => {
        safeToRemove?.();
        const el = returnTo.current;
        if (el && el.isConnected) el.focus({ preventScroll: true });
      },
      () => safeToRemove?.(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  const dismiss = () => {
    closeReason.current = "dismiss";
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = focusables(panelRef.current);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Phones only (desktop is a card with a close button). Under reduced motion the sheet still
  // follows the finger (user-driven), only the flourishes go.
  const canDrag = isPhone;
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    dragControls.start(e);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const h = panelRef.current?.offsetHeight ?? 600;
    if (info.offset.y > Math.min(120, h * 0.25) || info.velocity.y > 600) {
      closeReason.current = "drag";
      onClose();
    } else {
      play(animate(panelY, 0, spring.sheet));
    }
  };

  const world = variant === "world";
  const radius = world ? "rounded-none sm:rounded-sheet" : "rounded-t-sheet sm:rounded-sheet";

  return (
    <div className="fixed inset-0" style={{ zIndex: "var(--z-sheet)" }}>
      <motion.div aria-hidden className="absolute inset-0" style={{ background: "var(--scrim)", opacity: scrim }} onClick={dismiss} />
      <div className={cn("pointer-events-none absolute inset-0 flex justify-center sm:items-center sm:p-6", world ? "items-stretch" : "items-end")}>
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          drag={canDrag ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 1 }}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          className={cn(
            "pointer-events-auto relative flex w-full flex-col outline-none",
            world ? "h-full sm:h-[min(52rem,100%)] sm:max-w-[40rem]" : "max-h-[90svh] sm:max-h-[min(44rem,100%)] sm:max-w-[34rem]",
          )}
          style={{ y: panelY, opacity: panelOpacity }}
          data-sheet={variant}
        >
          {/* The paper: the only layer that morphs (a plain surface, so scaling it is cheap). */}
          <motion.div
            ref={paperRef}
            aria-hidden
            className={cn("paper-grain absolute inset-0 overflow-hidden bg-paper shadow-sheet", radius)}
            style={{ x: paperX, y: paperY, scaleX: paperSX, scaleY: paperSY, opacity: paperOpacity }}
          >
            {accent ? <div className="h-1" style={{ background: accentVar(accent) }} /> : null}
          </motion.div>

          <motion.div className="relative flex min-h-0 flex-1 flex-col" style={{ opacity: content, y: contentY }}>
            <div
              onPointerDown={startDrag}
              className={cn(
                "relative flex shrink-0 items-center gap-3 px-5 pb-2",
                world ? "pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4" : "pt-4",
                canDrag && "touch-none",
              )}
            >
              {canDrag ? <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-pill bg-paper-shadow" /> : null}
              <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
                <h2
                  id={titleId}
                  className="display pt-1 text-[1.3rem] leading-[1.15] text-balance text-ink [&_em]:text-current"
                  style={accent ? { color: accentInkVar(accent) } : undefined}
                >
                  {paired(title)}
                </h2>
                {description ? (
                  <p id={descId} className="text-sm text-ink-faded">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label={closeLabel}
                className="tap-target -mr-2 ml-auto inline-flex items-center justify-center rounded-pill text-ink-soft transition-colors hover:text-ink"
                data-sheet-close
              >
                <IconClose size={22} />
              </button>
            </div>
            {/* A world fills the scroller to its very bottom in its own colour (its own bottom padding
                clears the home indicator), so the scroller adds no padding of its own there, and its
                corners follow the card's on larger screens. */}
            <div
              data-lenis-prevent
              className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", world ? "sm:rounded-b-sheet" : !footer && "safe-bottom", className)}
            >
              {children}
            </div>
            {footer ? <div className="safe-bottom shrink-0 border-t border-paper-shadow px-5 pt-3">{footer}</div> : null}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
