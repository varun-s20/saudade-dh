"use client";

/**
 * <FirstTapReveal>: the first-tap ceremony (MASTER_BUILD_PROMPT §6.4, MOTION_SPEC §3).
 *
 *   intro      desk tone fades in, the sealed envelope rises and settles, the heart seal glows
 *   threshold  "Someone who misses you sent this." + Tap to open (the gesture that unlocks audio)
 *   opening    seal lifts → flap opens in 3D → folded letter drawn out → envelope falls away →
 *              letter opens (thirds) as it grows to the page → stamps placed one by one, each
 *              cancelled by its postmark → "Tap a stamp to open it."
 *   settled    the same tree as <EnvelopeView>: interactive stamp buttons, no jump
 *
 * Rules: nothing starts without the recipient's gesture; Skip appears after the tap (never before
 * 1.5 s) and jumps to the settled state; `onComplete` fires exactly once, after settle or Skip;
 * reduced motion = crossfades only. `mode="preview"` is visually identical (the caller simply
 * doesn't record anything). Sound is optional, after the gesture only, with a visible mute.
 */
import { AnimatePresence, animate, motion, motionValue, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { site } from "@/config/site";
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useDevice } from "@/lib/state/device";
import { STAMPS } from "@/config/stamps";
import { ease, reveal } from "@/lib/tokens";
import { Envelope, ENVELOPE_ASPECT } from "@/components/envelope/Envelope";
import { EnvelopeBoard, DEFAULT_HINT } from "@/components/envelope/EnvelopeBoard";
import { createStampMotion } from "@/components/envelope/StampButton";
import { IconVolumeOff, IconVolumeOn } from "@/components/ui/icons";
import { inkClasses } from "@/components/ui/InkButton";
import { FoldedLetter } from "./FoldedLetter";
import { createRevealSound, type RevealSound } from "./sound";
import {
  GLOW_BREATHS,
  envelopeRect,
  introSequence,
  letterPath,
  openingSequence,
  primeStamps,
  type RevealGeometry,
  type RevealValues,
} from "./timeline";

export interface RevealResult {
  /** True when the recipient pressed Skip (or the ceremony was cut short by a resize). */
  skipped: boolean;
  /** True when the reduced-motion crossfade ran instead of the full ceremony. */
  reducedMotion: boolean;
}

export interface FirstTapRevealProps {
  /** Stamps with content. Only these are placed. */
  kinds: readonly StampKind[];
  /** NEW marks, shown once settled (usually empty on a first tap). */
  newKinds?: ReadonlySet<StampKind>;
  toName?: string | null;
  fromName?: string | null;
  /** Threshold line. Default "Someone who misses you sent this." */
  prompt?: string;
  /** ISO date printed on the postmarks. */
  postmarkDate?: string | null;
  /** Extra words for each stamp's accessible label (see EnvelopeView). */
  details?: Partial<Record<StampKind, string>>;
  /** Settled hint. Default "Tap a stamp to open it." */
  hint?: string | null;
  /** "preview" (sender's Replay) is visually identical; the caller just doesn't record it. */
  mode?: "live" | "preview";
  /** Fill the parent box instead of the viewport (preview frame, playground). */
  contained?: boolean;
  /**
   * Design review only (the motion playground's slow-motion control): 0.25 = four times slower.
   * Sound is disabled when ≠ 1. Production screens never set it.
   */
  playbackRate?: number;
  /** Fires once: after the last stamp settles, or on Skip. Record the reveal here (never on mount). */
  onComplete: (result: RevealResult) => void;
  /** A stamp was tapped (settled state only). Pass originRect to <Sheet>. */
  onOpenStamp: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
  className?: string;
}

type Phase = "intro" | "threshold" | "opening" | "settled";

/** The settled pose of everything that stays on screen (Skip / interruption safety net). */
function settleValues(v: RevealValues) {
  v.desk.set(1);
  v.face.set(1);
  v.decor.set(1);
  v.hint.set(1);
  v.prompt.set(0);
  v.chrome.set(0);
  v.letter.visible.set(0);
  for (const k of STAMP_KINDS) {
    const s = v.stamps[k];
    s.opacity.set(1);
    s.y.set(0);
    s.scale.set(1);
    s.rotate.set(0);
    s.cast.set(0);
    s.mark.set(1);
    s.markScale.set(1);
  }
}

const DEFAULT_PROMPT = "Someone who misses you sent this.";

function createValues(): RevealValues {
  const stamps = {} as Record<StampKind, ReturnType<typeof createStampMotion>>;
  for (const k of STAMP_KINDS) stamps[k] = createStampMotion();
  return {
    desk: motionValue(0),
    envEnterY: motionValue(0),
    envOpacity: motionValue(0),
    env: { flap: motionValue(0), seal: motionValue(0), glow: motionValue(0), bodyY: motionValue(0), bodyOpacity: motionValue(1) },
    prompt: motionValue(0),
    promptY: motionValue(8),
    chrome: motionValue(0),
    letter: {
      x: motionValue(0),
      y: motionValue(0),
      scale: motionValue(1),
      top: motionValue(-180),
      bottom: motionValue(180),
      plate: motionValue(0),
      visible: motionValue(0),
    },
    face: motionValue(0),
    decor: motionValue(0),
    hint: motionValue(0),
    stamps,
  };
}

export function FirstTapReveal({
  kinds: kindsProp,
  newKinds,
  toName,
  fromName,
  prompt = DEFAULT_PROMPT,
  postmarkDate,
  details,
  hint = DEFAULT_HINT,
  mode = "live",
  contained,
  playbackRate = 1,
  onComplete,
  onOpenStamp,
  className,
}: FirstTapRevealProps) {
  const reduced = useReducedMotionPref();
  const hydrated = useHydrated();
  const muted = useDevice((s) => s.soundMuted);
  const setMuted = useDevice((s) => s.setSoundMuted);
  const kinds = STAMP_KINDS.filter((k) => kindsProp.includes(k));
  const kindsKey = kinds.join(",");

  const [v] = useState(createValues);
  const [phase, setPhase] = useState<Phase>("intro");
  const [geo, setGeo] = useState<RevealGeometry | null>(null);
  const [skipReady, setSkipReady] = useState(false);
  const [announce, setAnnounce] = useState("");

  const phaseRef = useRef<Phase>("intro");
  const stageRef = useRef<HTMLElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<AnimationPlaybackControls | null>(null);
  const glowRef = useRef<AnimationPlaybackControls | null>(null);
  const openRef = useRef<AnimationPlaybackControls | null>(null);
  const timers = useRef<number[]>([]);
  const completed = useRef(false);
  const usedKeyboard = useRef(false);
  const soundRef = useRef<RevealSound | null>(null);
  const reducedAtOpen = useRef(reduced);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ── Measure the stage and the face (before paint); keep current until the tap. ──
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const face = faceRef.current;
    if (!stage || !face) return null;
    const s = stage.getBoundingClientRect();
    const f = face.getBoundingClientRect();
    const env = envelopeRect(s.width, s.height, ENVELOPE_ASPECT);
    const g: RevealGeometry = {
      stageW: s.width,
      stageH: s.height,
      env,
      face: { x: f.left - s.left, y: f.top - s.top, w: f.width, h: f.height },
    };
    return g;
  }, []);

  const finish = useCallback(
    (skipped: boolean) => {
      if (completed.current) return;
      completed.current = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (skipped) {
        soundRef.current?.stopAll();
        introRef.current?.complete();
        openRef.current?.complete();
        settleValues(v);
      }
      glowRef.current?.stop();
      go("settled");
      const names = kinds.map((k) => STAMPS[k].label.toLowerCase());
      setAnnounce(
        `Your envelope is open. ${names.length === 1 ? "One stamp" : `${names.length} stamps`} inside: ${names.join(", ")}. ${hint ?? ""}`.trim(),
      );
      onCompleteRef.current({ skipped, reducedMotion: reducedAtOpen.current });
      if (usedKeyboard.current) {
        requestAnimationFrame(() => stageRef.current?.querySelector<HTMLButtonElement>("[data-stamp-button]")?.focus());
      }
    },
    // kinds/hint are read at completion time; kindsKey keeps the callback honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kindsKey, hint],
  );

  // ── Intro (mount): never anything with sound, never the opening itself. ──
  useLayoutEffect(() => {
    const g = measure();
    if (!g) return;
    // Layout measurement must land before first paint (no flash of a mis-placed envelope).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeo(g);
    if (phaseRef.current !== "intro") return;
    v.letter.visible.set(0);
    const rate = playbackRate;
    const intro = animate(introSequence(v, g, reduced));
    intro.speed = rate;
    introRef.current = intro;
    if (!reduced) {
      const glow = animate(v.env.glow, [...GLOW_BREATHS.keyframes], {
        duration: GLOW_BREATHS.duration,
        delay: GLOW_BREATHS.delay,
        ease: "easeInOut",
      });
      glow.speed = rate;
      glowRef.current = glow;
    } else {
      v.env.glow.set(0.7);
    }
    const t1 = window.setTimeout(
      () => {
        if (phaseRef.current === "intro") go("threshold");
      },
      ((reduced ? 0.8 : reveal.promptAppear) * 1000 - 50) / rate,
    );
    const t2 = window.setTimeout(() => setSkipReady(true), (reveal.skippableAfter * 1000) / rate);
    timers.current.push(t1, t2);
    return () => {
      intro.stop();
      glowRef.current?.stop();
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // Mount-only by design: the intro plays once per mount (Replay = remount with a new key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // Keep geometry current while waiting; a real resize mid-ceremony jumps to the settled state.
  // (ResizeObserver also fires once on observe; unchanged sizes are ignored.)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let last = { w: stage.offsetWidth, h: stage.offsetHeight };
    const ro = new ResizeObserver(() => {
      const size = { w: stage.offsetWidth, h: stage.offsetHeight };
      if (size.w === last.w && size.h === last.h) return;
      last = size;
      const p = phaseRef.current;
      if (p === "opening") finishRef.current(true);
      else if (p !== "settled") {
        const g = measure();
        if (g) setGeo(g);
      }
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [measure]);

  // Activity (README rule 4) hides a route by running effect cleanups. If that happens
  // mid-ceremony, stop everything; when the route is shown again the reveal completes as skipped
  // (it is never resumed half-way). The sound engine is released here too.
  const interrupted = useRef(false);
  useLayoutEffect(() => {
    if (interrupted.current) {
      interrupted.current = false;
      finishRef.current(true);
    }
    return () => {
      soundRef.current?.dispose();
      soundRef.current = null;
      if (phaseRef.current === "opening") {
        openRef.current?.stop();
        timers.current.forEach(clearTimeout);
        timers.current = [];
        interrupted.current = true;
      }
    };
  }, []);
  useEffect(() => {
    soundRef.current?.setMuted(muted);
  }, [muted]);

  // ── The tap. Everything that needs the gesture happens synchronously in here. ──
  const open = () => {
    const p = phaseRef.current;
    if (p === "opening" || p === "settled" || completed.current) return;
    const g = measure() ?? geo;
    if (!g) return;
    setGeo(g);

    if (site.revealSound && playbackRate === 1) {
      soundRef.current ??= createRevealSound(muted);
      soundRef.current.unlock();
    }
    introRef.current?.complete();
    glowRef.current?.stop();
    reducedAtOpen.current = reduced;

    // A slight random turn per stamp (event handler, so randomness is allowed here).
    const jitter = kinds.map((_, i) => (i % 2 ? 1 : -1) * (2.5 + Math.random() * 4));
    primeStamps(v, kinds, jitter, reduced);
    const path = letterPath(g);
    v.letter.x.set(path.inside.x);
    v.letter.y.set(path.inside.y);
    v.letter.scale.set(path.inside.scale);
    v.letter.top.set(-180);
    v.letter.bottom.set(180);
    v.letter.plate.set(0);
    v.letter.visible.set(reduced ? 0 : 1);

    go("opening");
    const plan = openingSequence(v, g, kinds, jitter, reduced);
    const controls = animate(plan.sequence);
    controls.speed = playbackRate;
    openRef.current = controls;
    for (const c of plan.cues) soundRef.current?.play(c.cue, { at: c.at });
    controls.then(
      () => finish(false),
      () => undefined,
    );
  };

  const skip = () => finish(true);

  // Escape skips once the ceremony is running.
  useEffect(() => {
    if (phase !== "opening") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        usedKeyboard.current = true;
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onTapKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") usedKeyboard.current = true;
  };

  const settled = phase === "settled";
  const showEnvelope = !settled && geo;
  const promptTop = geo ? geo.env.y + geo.env.h + Math.max(24, geo.stageH * 0.035) : 0;

  return (
    <EnvelopeBoard
      stageRef={stageRef}
      faceRef={faceRef}
      kinds={kinds}
      newKinds={newKinds}
      showNew={settled}
      toName={toName}
      fromName={fromName}
      postmarkDate={postmarkDate}
      details={details}
      hint={hint}
      entrance="driven"
      interactive={settled}
      reduced={reduced}
      contained={contained}
      stampMotion={v.stamps}
      deskOpacity={v.desk}
      faceOpacity={v.face}
      decorOpacity={v.decor}
      hintOpacity={v.hint}
      onOpenStamp={onOpenStamp}
      className={className}
      aria-label={settled ? "Your envelope" : "A letter for you"}
    >
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {showEnvelope ? (
        <>
          {/* The sealed envelope. Tapping it opens it too (the visible button is the a11y path). */}
          <motion.div
            aria-hidden
            className="absolute z-10 cursor-pointer"
            style={{ left: geo.env.x, top: geo.env.y, width: geo.env.w, y: v.envEnterY, opacity: v.envOpacity }}
            onClick={open}
            data-mode={mode}
          >
            <Envelope
              drive={v.env}
              toName={toName}
              contents={
                reduced ? null : (
                  <FoldedLetter
                    mv={v.letter}
                    left={geo.face.x - geo.env.x}
                    top={geo.face.y - geo.env.y}
                    width={geo.face.w}
                    height={geo.face.h}
                  />
                )
              }
            />
          </motion.div>

          {/* Threshold: one line, one action. */}
          <motion.div
            className="absolute inset-x-0 z-[11] flex flex-col items-center gap-5 px-6 text-center"
            style={{ top: promptTop, opacity: v.prompt, y: v.promptY }}
          >
            <p role="status" aria-live="polite" className="max-w-[24rem] font-script text-[clamp(2.2rem,1.7rem+2vw,3.1rem)] leading-[1.02] text-paper">
              {phase === "intro" ? "" : prompt}
            </p>
            {phase === "threshold" || phase === "intro" ? (
              <button
                type="button"
                onClick={open}
                onKeyDown={onTapKey}
                tabIndex={phase === "intro" ? -1 : 0}
                className={inkClasses("paper", "lg", false, "font-display text-[1.05rem] tracking-[0.04em] uppercase")}
                data-reveal-tap
              >
                <span className="sd-ink__face">
                  <svg aria-hidden width="16" height="15" viewBox="0 0 16 15" className="text-wax">
                    <path
                      d="M8 14.2s-6.6-4-6.6-8.6A3.6 3.6 0 0 1 8 3.3a3.6 3.6 0 0 1 6.6 2.3C14.6 10.2 8 14.2 8 14.2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="sd-ink__label">Tap to open</span>
                </span>
              </button>
            ) : null}
          </motion.div>
        </>
      ) : null}

      {/* Chrome: Skip (after the tap, never before 1.5 s) and the sound toggle. */}
      {!settled ? (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between px-3"
          style={{ opacity: v.chrome }}
        >
          <div className="min-w-[var(--tap-min)]">
            <AnimatePresence>
              {phase === "opening" && skipReady ? (
                <motion.button
                  key="skip"
                  type="button"
                  onClick={skip}
                  className="postal-label pointer-events-auto tap-target rounded-pill px-3 font-bold text-paper/90"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: ease.out }}
                  data-reveal-skip
                >
                  Skip
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
          {site.revealSound && hydrated ? (
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              className="pointer-events-auto tap-target inline-flex items-center justify-center rounded-pill text-paper/90"
              data-reveal-mute
            >
              {muted ? <IconVolumeOff size={22} /> : <IconVolumeOn size={22} />}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </EnvelopeBoard>
  );
}
