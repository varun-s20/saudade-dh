"use client";

/**
 * "A year in one envelope" (D-067): the example envelope, told as a pinned scroll sequence
 * (the later.com pattern: a section holds the screen while its story plays, scrubbed by scroll).
 * Over five months, postcards, a letter, a voice note and a song rise out of an open envelope into
 * a growing fan; the date and the season change; a plane flies along the year.
 *
 * Motion (Emil Kowalski):
 * - Scroll-scrubbed pieces follow the finger exactly (they're tied to scroll, so they need no
 *   easing of their own). Each card's progress is a CSS variable on that card only, and its
 *   transform is computed in CSS from it (cheap: no inherited recalculation down the page).
 * - Chapter text changes are discrete, so they crossfade with a little blur (320ms, ease-out).
 * - Season colours crossfade as stacked layers (opacity only).
 * - Reduced motion: not pinned; the finished envelope and the whole year are shown at once.
 * Screen readers get the year as a plain list; the animated stage is decorative.
 */
import Image from "next/image";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { Stamp } from "@/components/stamps/Stamp";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { BiplaneCraft } from "./HomeArt";

type Card =
  | { kind: "photo"; src: string; w: number; h: number; cap: string }
  | { kind: "letter" }
  | { kind: "voice" }
  | { kind: "song" };

const CHAPTERS: { month: string; year: string; moment: string; added: string; season: string; thumb: string; cards: (Card & { a: number })[] }[] = [
  {
    month: "Oct",
    year: "2026",
    moment: "Given on his birthday",
    added: "a letter and the lane to the sea",
    season: "var(--grad-sunset)",
    thumb: "/demo/photos/03.jpg",
    cards: [
      { kind: "letter", a: -7 },
      { kind: "photo", src: "/demo/photos/03.jpg", w: 1067, h: 1600, cap: "the lane to the sea", a: 7 },
    ],
  },
  {
    month: "Dec",
    year: "2026",
    moment: "A hard week",
    added: "a voice note and a coffee",
    season: "linear-gradient(180deg, #b9dde6 0%, #8ec6d3 100%)",
    thumb: "/demo/photos/04.jpg",
    cards: [
      { kind: "photo", src: "/demo/photos/04.jpg", w: 1600, h: 1216, cap: "coffee, missing you", a: -17 },
      { kind: "voice", a: 17 },
    ],
  },
  {
    month: "Feb",
    year: "2027",
    moment: "Just because",
    added: "Biscuit, waiting by the door",
    season: "linear-gradient(180deg, #f7c9d2 0%, #eea3b3 100%)",
    thumb: "/demo/photos/06.jpg",
    cards: [{ kind: "photo", src: "/demo/photos/06.jpg", w: 1600, h: 1067, cap: "Biscuit waits by the door", a: -27 }],
  },
  {
    month: "May",
    year: "2027",
    moment: "Planning the summer",
    added: "a lake, and a song for the drive",
    season: "linear-gradient(180deg, #cfe8c6 0%, #a9d49e 100%)",
    thumb: "/demo/photos/05.jpg",
    cards: [
      { kind: "photo", src: "/demo/photos/05.jpg", w: 1067, h: 1600, cap: "next summer: this lake?", a: 27 },
      { kind: "song", a: -36 },
    ],
  },
  {
    month: "Oct",
    year: "2027",
    moment: "One year on",
    added: "the pier where it started",
    season: "linear-gradient(180deg, #f6d27a 0%, #f0a65a 100%)",
    thumb: "/demo/photos/01.jpg",
    cards: [{ kind: "photo", src: "/demo/photos/01.jpg", w: 1600, h: 1067, cap: "a year on, the pier", a: 0 }],
  },
];

const N = CHAPTERS.length;
/** Scroll progress where chapter i begins (a little lead-in before the first, a hold after the last). */
const start = (i: number) => 0.04 + i * 0.18;
const CARDS = CHAPTERS.flatMap((c, ci) => c.cards.map((card, k) => ({ ...card, ci, k, last: ci === N - 1 })));

export function YearInEnvelope() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [chapter, setChapter] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    let c = 0;
    for (let i = 0; i < N; i++) if (p >= start(i) - 0.02) c = i;
    if (c !== chapter) setChapter(c);
  });

  const shown = reduced ? N - 1 : chapter;
  const ch = CHAPTERS[shown];
  const photos = CARDS.filter((c) => c.kind === "photo" && c.ci <= shown).length;
  const rail = useTransform(scrollYProgress, [start(0), start(N - 1) + 0.1], [0, 1], { clamp: true });
  const flight = useTransform(rail, (r) => `${r * 100}%`);

  return (
    <section ref={ref} aria-labelledby="year-title" className="hm-yr" data-static={reduced || undefined}>
      <div className="hm-yr__stage">
        {/* the seasons, crossfading underneath */}
        {CHAPTERS.map((c, i) => (
          <Season key={i} i={i} p={scrollYProgress} bg={c.season} reduced={reduced} />
        ))}

        <div className="wrap hm-yr__grid">
          <div className="hm-yr__copy">
            <p className="eyebrow text-ink/80">An example envelope · from Mira to Theo</p>
            <h2 id="year-title" className="display hm-yr__title">
              A year in <em>one envelope.</em>
            </h2>

            <div aria-hidden className="hm-yr__now">
              <p key={`d${shown}`} className="hm-yr__date hm-yr-swap">
                {ch.month}
                <span>{ch.year}</span>
              </p>
              <p key={`m${shown}`} className="script hm-yr__moment hm-yr-swap">
                {ch.moment}
              </p>
              <p key={`a${shown}`} className="hm-yr__added hm-yr-swap">
                + {ch.added}
              </p>
            </div>

            <p aria-hidden className="hm-yr__tally">
              <span>
                <b>{photos}</b> photo{photos === 1 ? "" : "s"}
              </span>
              <span data-on>letter</span>
              <span data-on={shown >= 1 || undefined}>voice</span>
              <span data-on={shown >= 3 || undefined}>song</span>
            </p>

            <ol className="sr-only">
              {CHAPTERS.map((c, i) => (
                <li key={i}>
                  {c.month} {c.year}: {c.moment}. Added {c.added}.
                </li>
              ))}
            </ol>
            <p className="hm-yr__note">Your code never expires, so the envelope keeps growing long after it&apos;s been given.</p>
          </div>

          <div aria-hidden className="hm-yr__desk">
            <div className="hm-yr__env">
              <span className="hm-yr__flap" />
              <span className="hm-yr__back" />
              <div className="hm-yr__fan">
                {CARDS.map((c, i) => (
                  <FanCard key={i} card={c} p={scrollYProgress} reduced={reduced} z={i + 1} />
                ))}
              </div>
              <svg className="hm-yr__front" viewBox="0 0 600 380" preserveAspectRatio="none">
                <path d="M0 0 L300 196 L600 0 L600 380 L0 380 Z" fill="var(--paper-raised)" />
                <path d="M0 380 L246 168 M600 380 L354 168" stroke="var(--paper-shadow)" strokeWidth="2" fill="none" />
                <path d="M0 0 L300 196 L600 0" stroke="var(--paper-edge)" strokeWidth="2" fill="none" />
              </svg>
              <span className="hm-yr__seal">
                <HeartSeal size={64} />
              </span>
              <span className="hm-yr__to">for Theo</span>
              <span className="hm-yr__stamp">
                <Stamp kind="letter" width={58} rotate={6} />
              </span>
            </div>
          </div>
        </div>

        {/* the year as an airmail route with a stop for each month, and a stamp hanging from each
            stop: months still to come wait greyed out; each month reached is postmarked, and the
            current one lifts. The biplane flies the route above the stamps, in its own lane. */}
        <div aria-hidden className="wrap hm-yr__rail">
          <div className="hm-yr__route">
            <motion.span className="hm-yr__fill" style={{ scaleX: reduced ? 1 : rail }} />
            {CHAPTERS.map((c, i) => (
              <span key={i} className="hm-yr__pin" data-on={i <= shown || undefined} style={{ left: `${(i / (N - 1)) * 100}%` }} />
            ))}
            {/* a route-wide layer slides by its own width, carrying the plane (transform only) */}
            <motion.span className="hm-yr__flight" style={{ x: reduced ? "100%" : flight }}>
              <span className="hm-yr__plane">
                <BiplaneCraft className="hm-yr__craft" clipId="hm-yr-plane-fin" />
              </span>
            </motion.span>
          </div>
          <ol className="hm-yr__stops">
            {CHAPTERS.map((c, i) => (
              <li key={i} data-on={i <= shown || undefined} data-now={i === shown || undefined}>
                <span className="hm-yr__tick">
                  <span className="hm-yr__stampface perforated">
                    <span className="hm-yr__thumb">
                      <Image src={c.thumb} alt="" fill sizes="96px" />
                    </span>
                    <span className="hm-yr__mo">{c.month}</span>
                  </span>
                  <svg className="hm-yr__cancel" viewBox="0 0 64 64">
                    <circle cx="22" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="2.4" />
                    <path d="M8 26h28M8 38h28" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M38 22q4 -3 8 0t8 0t8 0M38 30q4 -3 8 0t8 0t8 0M38 38q4 -3 8 0t8 0t8 0M38 46q4 -3 8 0t8 0t8 0" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>
                <small>{c.year}</small>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Season({ i, p, bg, reduced }: { i: number; p: MotionValue<number>; bg: string; reduced: boolean }) {
  const s = start(i);
  const opacity = useTransform(p, i === 0 ? [0, 1] : [s - 0.07, s + 0.02], i === 0 ? [1, 1] : [0, 1], { clamp: true });
  return <motion.span aria-hidden className="hm-yr__season" style={{ background: bg, opacity: reduced ? (i === N - 1 ? 1 : 0) : opacity }} />;
}

function FanCard({ card, p, reduced, z }: { card: (typeof CARDS)[number]; p: MotionValue<number>; reduced: boolean; z: number }) {
  // Each card rises during the first part of its chapter (two cards in a chapter take turns).
  const s = start(card.ci) + card.k * 0.06;
  const t = useTransform(p, [s, s + 0.09], [0, 1], { clamp: true });
  const style = { "--t": reduced ? 1 : t, "--a": `${card.a}deg`, zIndex: z } as unknown as CSSProperties;
  return (
    <motion.div className="hm-yr__card" data-kind={card.kind} data-last={card.last || undefined} style={style}>
      {card.kind === "photo" ? (
        <figure className="hm-yr__photo">
          <Image src={card.src} alt="" width={card.w} height={card.h} sizes="(min-width: 768px) 13rem, 34vw" />
          <figcaption>{card.cap}</figcaption>
        </figure>
      ) : card.kind === "letter" ? (
        <div className="hm-yr__letter">
          <span>Dear Theo,</span>
          <span>It&apos;s raining here the way it used to on Thursdays…</span>
        </div>
      ) : card.kind === "voice" ? (
        <div className="hm-yr__voice">
          <span className="hm-yr__bars">
            {[0.4, 0.8, 0.55, 1, 0.7, 0.35, 0.9, 0.6, 0.45, 0.75, 0.5].map((h, i) => (
              <i key={i} style={{ "--h": h } as CSSProperties} />
            ))}
          </span>
          <b>1:08</b>
          <span>a voice note</span>
        </div>
      ) : (
        <div className="hm-yr__song">
          <span className="hm-yr__vinyl" />
          <b>Here Comes the Sun</b>
          <span>for the drive</span>
        </div>
      )}
    </motion.div>
  );
}
