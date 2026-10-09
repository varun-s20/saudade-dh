"use client";

/**
 * S18 "still being written": the sealed envelope resting on the desk, a soft postmark with
 * today's date, and one warm line. Nothing is recorded here, so the first-open moment is kept for
 * when the envelope is ready (US-9).
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Envelope } from "@/components/envelope/Envelope";
import { Postmark } from "@/components/paper/Postmark";
import { useNow } from "@/components/public/useNow";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { ease } from "@/lib/tokens";
import { cn } from "@/lib/utils/cn";
import { localIsoDate } from "./labels";
import "./recipient.css";

export interface EmptyEnvelopeProps {
  toName?: string | null;
  contained?: boolean;
  /** Extra content under the copy (the sender preview explains what this is). */
  note?: ReactNode;
}

export function EmptyEnvelope({ toName, contained, note }: EmptyEnvelopeProps) {
  const reduced = useReducedMotionPref();
  const now = useNow();
  const today = now ? localIsoDate(now) : null;

  return (
    <section
      aria-labelledby="still-being-written"
      className={cn("rc-desk relative flex w-full flex-col items-center justify-center overflow-hidden px-6 py-12", contained ? "h-full" : "min-h-svh")}
      data-recipient-state="empty"
    >
      <motion.div
        className="flex w-full max-w-[24rem] flex-col items-center text-center"
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: ease.out }}
      >
        <div className="relative w-[min(80vw,22rem)]">
          <div className="shadow-envelope">
            <Envelope state="closed" toName={toName} glow={false} className="w-full" />
          </div>
          {today ? (
            <Postmark
              date={today}
              place="SAUDADE"
              variant="circle"
              size={92}
              rotate={-12}
              ink="red"
              opacity={0.75}
              className="pointer-events-none absolute -top-9 -right-3"
            />
          ) : null}
        </div>

        <h1 id="still-being-written" className="mt-12 font-script text-[clamp(2.3rem,1.7rem+2vw,3.2rem)] leading-[1.02] text-paper text-balance">
          Your letter is still being written ✉
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-paper/85">Someone is still filling this envelope for you. Come back and tap again soon.</p>
        {note}
      </motion.div>
    </section>
  );
}
