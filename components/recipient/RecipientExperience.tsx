"use client";

/**
 * <RecipientExperience>: what the recipient sees for an envelope, shared by the real route
 * (/t/[slug]) and the sender's preview (/s/[token]/preview) so the two are identical.
 *
 *   first_tap  <FirstTapReveal>, kept mounted after it settles (its last frame IS the envelope)
 *   repeat     <EnvelopeView entrance="calm"> with NEW marks
 *   empty      S18 "Your letter is still being written ✉"
 *
 * Tapping a stamp opens its world in a <Sheet variant="world"> that grows out of the stamp; each
 * world is lazy-loaded. Focus returns to the stamp on close (Sheet).
 *
 * This component records NOTHING on the server. The live route passes `onRevealComplete` (which
 * calls services.reveal.markRevealed); the preview passes nothing and uses variant="preview".
 *
 * The letter writes itself out the first time it is opened (D-082): on the live route, once per
 * letter version on this device (the device store remembers); in the preview, on every "First tap"
 * run, and never in "Coming back".
 */
import { motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { RecipientEnvelope, StampKind } from "@/lib/services/types";
import { filledKinds, recipientName, senderName } from "@/lib/recipient-mode";
import { STAMPS } from "@/config/stamps";
import { useDevice } from "@/lib/state/device";
import { FirstTapReveal, type RevealResult } from "@/components/reveal/FirstTapReveal";
import { EnvelopeView } from "@/components/envelope/EnvelopeView";
import { Sheet } from "@/components/ui/Sheet";
import { StampWorld, prefetchWorlds } from "@/components/worlds/StampWorld";
import { ease } from "@/lib/tokens";
import { EmptyEnvelope } from "./EmptyEnvelope";
import { stampDetails, worldTitle } from "./labels";

export type ExperienceMode = "first_tap" | "repeat" | "empty";

export interface RecipientExperienceProps {
  env: RecipientEnvelope;
  mode: ExperienceMode;
  /** Stamps updated since this device's last visit (repeat visits only). */
  newKinds?: ReadonlySet<StampKind>;
  /** "live" on the recipient route; "preview" in the sender's preview (never recorded). */
  variant?: "live" | "preview";
  /** Fill the parent box instead of the viewport (preview frame). */
  contained?: boolean;
  /** Postmark date for the envelope; default `env.sealedAt`. */
  postmarkDate?: string | null;
  /** Live route only: the ceremony settled or was skipped. Called once. */
  onRevealComplete?: (result: RevealResult) => void;
  /** Extra copy under the empty state (preview). */
  emptyNote?: ReactNode;
}

/** Run `fn` when the browser is idle (Safari has no requestIdleCallback). */
function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const t = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(t);
}

export function RecipientExperience({
  env,
  mode,
  newKinds,
  variant = "live",
  contained,
  postmarkDate,
  onRevealComplete,
  emptyNote,
}: RecipientExperienceProps) {
  const contents = env.contents;
  const kinds = useMemo(() => filledKinds(contents), [contents]);
  const details = useMemo(() => stampDetails(contents), [contents]);
  const toName = recipientName(contents);
  const fromName = senderName(contents);
  const date = postmarkDate === undefined ? env.sealedAt : postmarkDate;

  // The open world (`world`) and the last one opened (`shown`, kept so the sheet can animate
  // closed with its content). `epoch` re-creates the sheet after the route was hidden.
  const [world, setWorld] = useState<{ kind: StampKind; rect: DOMRect } | null>(null);
  const [shown, setShown] = useState<StampKind | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [settled, setSettled] = useState(mode !== "first_tap");

  // The letter types itself out on its first reading, then simply reads.
  const letterVersion = contents.letter?.updatedAt ?? "1";
  const readOnDevice = useDevice((s) => s.lettersRead[env.slug]);
  const [typedHere, setTypedHere] = useState(false);
  const typeLetter = !typedHere && (variant === "preview" ? mode === "first_tap" : readOnDevice !== letterVersion);
  const letterTyped = useCallback(() => {
    setTypedHere(true);
    if (variant === "live") useDevice.getState().markLetterRead(env.slug, letterVersion);
  }, [variant, env.slug, letterVersion]);

  // Activity (README rule 4): a hidden route closes its world; when shown again it starts on the
  // envelope, with a fresh sheet (no stale close animation, audio/embeds already torn down).
  useLayoutEffect(
    () => () => {
      setWorld(null);
      setEpoch((e) => e + 1);
    },
    [],
  );

  const openStamp = useCallback((kind: StampKind, rect: DOMRect) => {
    setShown(kind);
    setWorld({ kind, rect });
  }, []);
  const closeWorld = useCallback(() => setWorld(null), []);

  const handleComplete = useCallback(
    (result: RevealResult) => {
      setSettled(true);
      onRevealComplete?.(result);
    },
    [onRevealComplete],
  );

  // Warm the world chunks while the recipient looks at the settled envelope.
  const kindsKey = kinds.join(",");
  useEffect(() => {
    if (!settled || mode === "empty" || !kindsKey) return;
    return whenIdle(() => prefetchWorlds(kindsKey.split(",") as StampKind[]));
  }, [settled, mode, kindsKey]);

  let stage: ReactNode;
  if (mode === "empty") {
    stage = <EmptyEnvelope toName={toName} contained={contained} note={emptyNote} />;
  } else if (mode === "first_tap") {
    stage = (
      <FirstTapReveal
        mode={variant}
        contained={contained}
        kinds={kinds}
        toName={toName}
        fromName={fromName}
        postmarkDate={date}
        details={details}
        onComplete={handleComplete}
        onOpenStamp={openStamp}
      />
    );
  } else {
    stage = (
      // The desk fades in over the cream loading page, then the envelope settles (< 600 ms).
      <motion.div className={contained ? "h-full" : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: ease.out }}>
        <EnvelopeView
          entrance="calm"
          contained={contained}
          kinds={kinds}
          newKinds={newKinds}
          toName={toName}
          fromName={fromName}
          postmarkDate={date}
          details={details}
          onOpenStamp={openStamp}
        />
      </motion.div>
    );
  }

  return (
    <>
      {stage}
      <Sheet
        key={epoch}
        open={world !== null}
        onClose={closeWorld}
        variant="world"
        title={shown ? worldTitle(shown, fromName) : ""}
        accent={shown ? STAMPS[shown].accent : undefined}
        originRect={world?.rect ?? null}
        closeLabel="Back to the envelope"
      >
        {shown ? <StampWorld kind={shown} env={env} fromName={fromName} typeLetter={typeLetter} onLetterTyped={letterTyped} /> : null}
      </Sheet>
    </>
  );
}
