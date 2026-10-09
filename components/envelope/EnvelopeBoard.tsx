"use client";

/**
 * Internal: the recipient's settled scene (desk + envelope face + stamp buttons + hint).
 * Shared by <EnvelopeView> and <FirstTapReveal> so the reveal's last frame and the repeat-visit
 * view are the same tree, pixel for pixel (no jump at hand-off).
 *
 * Stage sizing: full screen with `svh` (stable under iOS toolbars, RESEARCH §4.11), or the
 * parent's box when `contained` (previews, the motion playground).
 */
import { motion, type MotionValue } from "motion/react";
import type { ReactNode, Ref } from "react";
import { STAMPS } from "@/config/stamps";
import type { StampKind } from "@/lib/services/types";
import { calm, ease } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";
import { EnvelopeFace } from "./EnvelopeFace";
import { StampButton, type StampEntrance, type StampMotion } from "./StampButton";

export interface EnvelopeBoardProps {
  kinds: readonly StampKind[];
  newKinds?: ReadonlySet<StampKind>;
  toName?: string | null;
  fromName?: string | null;
  postmarkDate?: string | null;
  details?: Partial<Record<StampKind, string>>;
  hint?: string | null;
  onOpenStamp?: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
  entrance: StampEntrance;
  interactive?: boolean;
  reduced: boolean;
  contained?: boolean;
  /** Driven mode (the reveal). */
  stampMotion?: Record<StampKind, StampMotion>;
  deskOpacity?: MotionValue<number>;
  faceOpacity?: MotionValue<number>;
  decorOpacity?: MotionValue<number>;
  hintOpacity?: MotionValue<number>;
  /** Show NEW marks (the reveal holds them back until it has settled). */
  showNew?: boolean;
  faceRef?: Ref<HTMLDivElement>;
  stageRef?: Ref<HTMLElement>;
  /** Layers above the face (the reveal's envelope, prompt and controls). */
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export const DEFAULT_HINT = "Tap a stamp to open it.";

export function EnvelopeBoard({
  kinds,
  newKinds,
  toName,
  fromName,
  postmarkDate,
  details,
  hint = DEFAULT_HINT,
  onOpenStamp,
  entrance,
  interactive = true,
  reduced,
  contained,
  stampMotion,
  deskOpacity,
  faceOpacity,
  decorOpacity,
  hintOpacity,
  showNew = true,
  faceRef,
  stageRef,
  children,
  className,
  "aria-label": ariaLabel = "Your envelope",
}: EnvelopeBoardProps) {
  const isCalm = entrance === "calm";

  return (
    <section
      ref={stageRef}
      aria-label={ariaLabel}
      className={cn("relative w-full overflow-hidden", contained ? "h-full" : "h-svh min-h-screen", className)}
      style={{ overscrollBehavior: "none" }}
    >
      {/* The table the letter rests on: a cobalt azulejo field (Lisbon Post), fading in over the cream page. */}
      <motion.div aria-hidden className="band-cobalt absolute inset-0" style={deskOpacity ? { opacity: deskOpacity } : undefined} />

      {/* The face box: inset paper on phones, a centred letter on the desk from sm up. */}
      <div
        className={cn(
          "absolute inset-x-2.5 top-[max(0.625rem,env(safe-area-inset-top))] bottom-[max(0.625rem,env(safe-area-inset-bottom))]",
          "sm:inset-0 sm:m-auto sm:h-[min(calc(100%-3rem),55rem)] sm:w-[min(var(--measure-phone),calc(100%-2rem))] lg:w-[min(34rem,calc(100%-2rem))]",
        )}
      >
        <motion.div className="h-full w-full" style={faceOpacity ? { opacity: faceOpacity } : undefined} inert={!interactive}>
          <motion.div
            className="h-full w-full"
            initial={isCalm ? { opacity: 0, y: reduced ? 0 : 10 } : false}
            animate={isCalm ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: calm.face, ease: ease.out }}
          >
            <EnvelopeFace
              fit="fill"
              faceRef={faceRef}
              kinds={kinds}
              toName={toName}
              fromName={fromName}
              postmarkDate={postmarkDate}
              decorOpacity={decorOpacity}
              footer={
                hint ? (
                  <motion.p
                    className="text-center text-[0.95rem] font-medium text-ink-faded"
                    style={hintOpacity ? { opacity: hintOpacity } : undefined}
                    initial={isCalm ? { opacity: 0 } : false}
                    animate={isCalm ? { opacity: 1 } : undefined}
                    transition={{ delay: calm.hintAt, duration: calm.face, ease: ease.out }}
                  >
                    {hint}
                  </motion.p>
                ) : null
              }
              renderSlot={(kind, slot) => (
                <StampButton
                  slot={slot}
                  label={STAMPS[kind].recipient.openLabel({ from: fromName ?? null, detail: details?.[kind] })}
                  isNew={showNew && Boolean(newKinds?.has(kind))}
                  entrance={entrance}
                  mv={stampMotion?.[kind]}
                  reduced={reduced}
                  onOpen={onOpenStamp}
                />
              )}
            />
          </motion.div>
        </motion.div>
      </div>

      {children}
    </section>
  );
}
