"use client";

/**
 * "What fits" → "The first tap" (D-071), after later.com's "The hype is real" and the scroll
 * that follows it (patterns only): a full-screen colour field with big stat cards, pinned; as the
 * page scrolls, the cards lift away, the colour field collapses into a rounded frame on one side
 * and becomes the photograph of the next scene, and the next scene's words rise in beside it.
 *
 * Motion (Emil Kowalski):
 * - Everything here is scrubbed by scroll (it follows the finger, so no easing of its own), and
 *   each layer is driven by its own 0 → 1 CSS variable; the geometry lives in CSS, so the
 *   collapse goes to the right half on wide screens and to the lower half on phones.
 * - transform, opacity and clip-path only. The numbers roll on drums once, on arrival.
 * - Layers that aren't on stage are `inert`, so the keyboard never lands on an invisible link.
 * - Reduced motion: no pin; the stats band, then the first-tap scene, as ordinary sections.
 */
import Image from "next/image";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { InView } from "@/components/motion/InView";
import { Odometer } from "@/components/motion/Odometer";
import { InkLink } from "@/components/ui/InkButton";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { PhoneMock } from "./HomeArt";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const STATS: { n: string; unit: string; label: string; icon: ReactNode }[] = [
  {
    n: "15",
    unit: "photos",
    label: "each with a caption in your hand",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect {...ICON} x="3" y="5" width="18" height="14" rx="2" />
        <path {...ICON} d="M3 16l5-5 4 4 3-3 6 6" />
        <circle {...ICON} cx="16" cy="9" r="1.6" />
      </svg>
    ),
  },
  {
    n: "3:00",
    unit: "minutes",
    label: "of your own voice",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect {...ICON} x="9" y="3" width="6" height="11" rx="3" />
        <path {...ICON} d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </svg>
    ),
  },
  {
    n: "1",
    unit: "song",
    label: "spinning on a record",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle {...ICON} cx="12" cy="12" r="9" />
        <circle {...ICON} cx="12" cy="12" r="2.5" />
        <path {...ICON} d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5" />
      </svg>
    ),
  },
  {
    n: "0",
    unit: "apps",
    label: "logins or passwords",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect {...ICON} x="6.5" y="2.5" width="11" height="19" rx="2.5" />
        <path {...ICON} d="M4 4l16 16" />
      </svg>
    ),
  },
];

const RITUAL = [
  "The seal lifts, the flap opens and the letter unfolds",
  "The stamps land one by one, each with its postmark",
  "Every visit after that opens calmly, straight to the envelope",
] as const;

/** A 0 → 1 scroll window, as a MotionValue. */
function useWindow(p: MotionValue<number>, a: number, b: number) {
  return useTransform(p, [a, b], [0, 1], { clamp: true });
}

export function HypeToTap() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = useState<"stats" | "both" | "tap">("stats");

  // The windows overlap on purpose: the photograph starts before the stats have quite gone (so
  // the field is never an empty panel), and the words wait until the field has mostly cleared
  // their side (so they never sit on its edge).
  const s = useWindow(p, 0.22, 0.36); // the stats lift away
  const c = useWindow(p, 0.27, 0.54); // the colour field collapses into the frame
  const m = useWindow(p, 0.31, 0.5); // the photograph comes up in it
  const ph = useWindow(p, 0.5, 0.66); // the phone slides up beside it
  const x = useWindow(p, 0.47, 0.62); // the words rise in
  const r0 = useWindow(p, 0.56, 0.64);
  const r1 = useWindow(p, 0.6, 0.68);
  const r2 = useWindow(p, 0.64, 0.72);
  const cta = useWindow(p, 0.68, 0.76);

  useMotionValueEvent(p, "change", (v) => {
    const next = v < 0.33 ? "stats" : v < 0.5 ? "both" : "tap";
    if (next !== stage) setStage(next);
  });

  if (reduced) {
    return (
      <>
        <section aria-labelledby="hype-title" className="hm-hype hm-hype--static band-sunset perf-edge">
          <Stats />
        </section>
        <section aria-labelledby="tap-title" className="hm-hype-tap--static section-y">
          <div className="wrap grid items-center gap-12 lg:grid-cols-2">
            <TapCopy />
            <div className="relative">
              <div className="hm-hype__photo-static postcard">
                <Image src="/demo/photos/02.jpg" alt="An empty railway platform, the tracks running towards a low sun" width={1600} height={1067} sizes="(min-width: 1024px) 40rem, 90vw" />
              </div>
              <div className="hm-hype__phone hm-hype__phone--static">
                <PhoneMock />
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const vars = (o: Record<string, MotionValue<number>>) => o as unknown as CSSProperties;

  return (
    <section ref={ref} aria-labelledby="hype-title" className="hm-hype">
      <div className="hm-hype__stage">
        {/* the colour field that becomes the photograph's frame */}
        <motion.div aria-hidden className="hm-hype__panel band-sunset" style={vars({ "--c": c })}>
          <motion.div className="hm-hype__media" style={vars({ "--m": m })}>
            <Image src="/demo/photos/02.jpg" alt="" width={1600} height={1067} sizes="(min-width: 960px) 46vw, 92vw" />
            <span className="hm-hype__cap">your last train out. I waved till it was gone</span>
          </motion.div>
        </motion.div>

        <motion.div className="hm-hype__stats" style={vars({ "--s": s })} inert={stage === "tap"}>
          <Stats />
        </motion.div>

        <motion.div aria-hidden className="hm-hype__phone" style={vars({ "--ph": ph })}>
          <PhoneMock />
        </motion.div>

        <motion.div className="hm-hype__copy" style={vars({ "--x": x })} inert={stage === "stats"}>
          <div className="wrap">
            <div className="hm-hype__copyin">
              <TapCopy rows={[r0, r1, r2]} cta={cta} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <div className="wrap hm-hype__statsin">
      <p className="eyebrow text-ink/80">What fits in one envelope</p>
      <h2 id="hype-title" className="display hm-hype__title">
        Small envelope. <em>Big feelings.</em>
      </h2>
      <InView as="ul" effect="rise" className="hm-hype__cards">
        {STATS.map((st, i) => (
          <li key={st.unit} className="hm-stat" style={{ "--i": i } as CSSProperties}>
            <span className="hm-stat__icon" aria-hidden>
              {st.icon}
            </span>
            <span className="hm-stat__n">
              <Odometer value={st.n} delay={200 + i * 140} />
            </span>
            <span className="hm-stat__unit">{st.unit}</span>
            <span className="hm-stat__label">{st.label}</span>
          </li>
        ))}
      </InView>
    </div>
  );
}

function TapCopy({ rows, cta }: { rows?: MotionValue<number>[]; cta?: MotionValue<number> }) {
  return (
    <div>
      <p className="eyebrow text-terracotta-ink">The first tap</p>
      <h2 id="tap-title" className="display hm-hype__tapTitle">
        It opens like a <em>letter.</em> Once.
      </h2>
      <p className="hm-hype__lede">
        Nothing moves until they tap. Then the envelope opens for them, slowly, the way a real letter does. It&apos;s the moment the whole thing is for.
      </p>
      <ol className="hm-hype__ritual">
        {RITUAL.map((r, i) => (
          <motion.li key={r} style={rows ? ({ "--r": rows[i] } as unknown as CSSProperties) : undefined}>
            <span className="hm-num">{i + 1}</span>
            <span>{r}</span>
          </motion.li>
        ))}
      </ol>
      <motion.div className="hm-hype__cta" style={cta ? ({ "--r": cta } as unknown as CSSProperties) : undefined}>
        <InkLink href="/help/tap" variant="ink" transition="var(--accent-cobalt)">
          How tapping works
        </InkLink>
      </motion.div>
    </div>
  );
}
