/**
 * Home page (S1), "Wish You Were Here" (DECISIONS D-060). A 1940s linen postcard told in nine
 * scenes: the large-letter hero, three postcards that turn over, a souvenir rack of the four
 * stamps, a sheet of occasion stamps, "wish you were here" written across a sunset, the first
 * tap, the numbers on a postcard back, a clothesline of postcards, and luggage-tag help.
 * Motion follows Emil Kowalski (see components/motion/*); references are noted per section.
 */
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { InView } from "@/components/motion/InView";
import { LargeLetters } from "@/components/motion/LargeLetters";
import { Odometer } from "@/components/motion/Odometer";
import { PostcardFlip } from "@/components/motion/PostcardFlip";
import { PostcardRack, type RackItem } from "@/components/motion/PostcardRack";
import { ExpandBand, ScrollFill } from "@/components/motion/ScrollScenes";
import { Postmark } from "@/components/paper/Postmark";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { Stamp } from "@/components/stamps/Stamp";
import { InkLink } from "@/components/ui/InkButton";
import { IconCheck } from "@/components/ui/icons";
import { STAMPS, WORLD_FILL } from "@/config/stamps";
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { GoodToKnowBento } from "./GoodToKnow";
import { HypeToTap } from "./HypeToTap";
import { Biplane, CodeTicket, OCCASION_ICONS, PostcardBack } from "./HomeArt";
import { YearInEnvelope } from "./YearInEnvelope";
import "./home.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const PHOTOS = ["/demo/photos/01.jpg", "/demo/photos/03.jpg", "/demo/photos/05.jpg", "/demo/photos/02.jpg", "/demo/photos/04.jpg", "/demo/photos/06.jpg"];

/** Back of an envelope: side folds and a closed flap. */
function EnvelopeBack() {
  return (
    <svg aria-hidden viewBox="0 0 300 200" preserveAspectRatio="none">
      <path d="M0 200 L128 108 M300 200 L172 108" stroke="var(--paper-shadow)" strokeWidth="1.4" fill="none" />
      <path d="M0 0 L150 118 L300 0 Z" fill="var(--paper-deep)" />
      <path d="M0 0 L150 118 L300 0" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

// ─── 1. Hero: "Greetings from someone who MISSES YOU" ───────────────────────

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hm-hero band-sky">
      <span aria-hidden className="hm-hero__sun" />
      <Biplane banner="No app · no login · never expires" />
      <div className="wrap hm-hero__inner">
        <p className="hm-hero__tag tag">A ceramic envelope · tap the heart to open</p>
        <h1 id="hero-title" className="hm-hero__title">
          <span className="script hm-hero__greet">Greetings from someone who</span>
          <LargeLetters word="Misses you" photos={PHOTOS} className="hm-hero__ll" delay={200} />
        </h1>
        <p className="hm-hero__lede">
          Photos, a letter in your own words, your voice and a song, inside a ceramic envelope. They hold their phone to the heart, and it opens like a real
          letter. No app, no login, no occasion needed.
        </p>
        <div className="hm-hero__ctas">
          <InkLink href="/claim" size="lg">
            Claim your code
          </InkLink>
          <InkLink href="/recover" variant="secondary" size="lg">
            Find my link
          </InkLink>
        </div>
      </div>
      {/* Postcards tucked behind the perforated edge (gumroad.com's peeking cards, as postcards) */}
      <div className="hm-hero__peek" aria-hidden>
        <div className="hm-peek hm-peek--a postcard">
          <Image src="/demo/photos/01.jpg" alt="" width={1600} height={1067} sizes="(min-width: 768px) 17rem, 45vw" className="hm-peek__img" priority />
          <p className="hm-peek__cap">the pier where we said goodbye</p>
        </div>
        <div className="hm-peek hm-peek--b">
          <EnvelopeBack />
          <span className="hm-peek__seal">
            <HeartSeal size={52} glow />
          </span>
          <span className="hm-peek__for">for Theo</span>
        </div>
        <div className="hm-peek hm-peek--c">
          <PostcardBack
            message={<p className="hm-hand">Dear Theo, it&apos;s raining here the way it used to on Thursdays…</p>}
            to={<span>To: Theo</span>}
            stamp={<Stamp kind="letter" width={44} rotate={4} />}
          />
        </div>
      </div>
    </section>
  );
}

// ─── 2. How it works: three postcards that turn over ───────────────────────

const STEPS: { title: string; scene: string; art: ReactNode; message: string; to: string; tilt: string }[] = [
  {
    title: "Claim your code",
    scene: "hm-scene--sun",
    art: <CodeTicket />,
    message: "It's on the card in the box, or in the email we sent you. Type it in and the envelope is yours. No account, no password.",
    to: "To: you, the sender",
    tilt: "-2.5deg",
  },
  {
    title: "Fill the four stamps",
    scene: "hm-scene--sky",
    art: (
      <div className="hm-four">
        {STAMP_KINDS.map((k, i) => (
          <span key={k} style={v({ "--r": `${[-8, 5, -4, 7][i]}deg` })}>
            <Stamp kind={k} width={56} rotate={0} />
          </span>
        ))}
      </div>
    ),
    message: "Photos, a letter, your voice and a song. Save as you go, and come back for years to change it or add more.",
    to: "To: whoever you miss",
    tilt: "1.5deg",
  },
  {
    title: "They tap the heart",
    scene: "hm-scene--coral",
    art: (
      <div className="hm-tapart">
        <HeartSeal size={78} glow />
      </div>
    ),
    message: "They hold their phone to the heart. The seal lifts, the envelope opens, and the stamps land one by one.",
    to: "To: someone far away",
    tilt: "-1deg",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="section-y scroll-mt-20">
      <div className="wrap">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-terracotta-ink">How it works</p>
          <h2 id="how-title" className="display mt-4 text-d1">
            Three postcards, <em>one moment.</em>
          </h2>
          <p className="mt-4 text-lede text-ink-soft">Turn each one over to read the back.</p>
        </div>
        <ol className="mt-12 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-7 lg:gap-10">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <PostcardFlip
                label={s.title}
                tilt={s.tilt}
                front={
                  <div className="hm-front">
                    <div className={`hm-scene ${s.scene}`}>
                      <span className="hm-scene__n">{i + 1}</span>
                      <div className="hm-scene__art">{s.art}</div>
                      <h3 className="hm-scene__title">{s.title}</h3>
                    </div>
                  </div>
                }
                back={
                  <PostcardBack
                    message={<p className="hm-hand">{s.message}</p>}
                    to={<span>{s.to}</span>}
                    stamp={<Postmark variant="circle" size={58} rotate={-12} place="SAUDADE · BY HAND" ink="red" opacity={0.85} />}
                  />
                }
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── 3. The four stamps: a souvenir rack ───────────────────────────────────

const WORLD: Record<StampKind, { blurb: string; facts: string[]; link: string; count?: [string, string] }> = {
  photos: {
    blurb: "Snapshots tucked into the envelope, with album corners and your captions underneath. They swipe through them like a little album.",
    facts: ["A caption on each", "Made light for any phone", "Reorder any time"],
    link: "Fill the photos stamp",
    count: ["15", "photos"],
  },
  letter: {
    blurb: "Your words on real stationery, in handwriting, readable whether it's one line or a whole page. Dear ___, and a sign-off.",
    facts: ["Handwritten look", "Short or long, it fits", "Any language"],
    link: "Write the letter",
  },
  voice: {
    blurb: "Record in your browser or upload a voice memo. It plays from a little vintage radio, in your own voice.",
    facts: ["Record or upload", "Re-record any time", "Plays on any phone"],
    link: "Record your voice",
    count: ["3:00", "minutes"],
  },
  song: {
    blurb: "Paste a Spotify or Apple Music link. It spins on a record while it plays: the song that sounds like the two of you.",
    facts: ["Spotify or Apple Music", "Official players", "Change it any time"],
    link: "Pick a song",
    count: ["1", "song"],
  },
};

function RackCard({ kind }: { kind: StampKind }) {
  const def = STAMPS[kind];
  return (
    <div className="hm-rackcard postcard">
      <div className="hm-rackcard__scene" style={v({ "--world": WORLD_FILL[kind] })}>
        <span className="script hm-rackcard__greet">Greetings from the</span>
        <span className="hm-rackcard__name">{def.label}</span>
        <span className="hm-rackcard__stamp">
          <Stamp kind={kind} width={92} rotate={-5} />
        </span>
      </div>
    </div>
  );
}

function RackDetail({ kind }: { kind: StampKind }) {
  const def = STAMPS[kind];
  const w = WORLD[kind];
  return (
    <div>
      <p className="eyebrow text-ochre">{def.denomination}</p>
      <h3 className="display mt-3 text-d2">{def.label}</h3>
      {w.count ? (
        <p className="hm-count">
          <Odometer value={w.count[0]} className="font-display" />
          <span className="eyebrow">{w.count[1]}</span>
        </p>
      ) : null}
      <p className="mt-4 max-w-md text-lede text-paper/90">{w.blurb}</p>
      <ul className="mt-6 space-y-2.5">
        {w.facts.map((f) => (
          <li key={f} className="flex items-center gap-3 font-semibold">
            <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-ochre text-ink">
              <IconCheck size={14} strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <InkLink href="/claim" variant="quiet">
          {w.link}
        </InkLink>
      </div>
    </div>
  );
}

export function FourStamps() {
  const items: RackItem[] = STAMP_KINDS.map((k) => ({ key: k, name: STAMPS[k].label, card: <RackCard kind={k} />, detail: <RackDetail kind={k} /> }));
  return (
    <section id="stamps" aria-labelledby="stamps-title" className="hm-rack band-sea perf-edge scroll-mt-20">
      <div className="wrap section-y">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-ochre">Four small worlds</p>
          <h2 id="stamps-title" className="display mt-4 text-d1">
            One envelope, <em>four stamps.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lede text-paper/90">Every stamp opens its own little world. Fill one, or all four. Spin the rack.</p>
        </div>
        <PostcardRack items={items} label="The four stamps" className="mt-12 md:mt-16" />
      </div>
    </section>
  );
}

// ─── 4. Occasions: a sheet of stamps ───────────────────────────────────────

const OCCASIONS: { label: string; icon: keyof typeof OCCASION_ICONS; tone: string; value: string }[] = [
  { label: "A birthday far away", icon: "cake", tone: "var(--accent-rose)", value: "1♥" },
  { label: "Long distance", icon: "plane", tone: "var(--accent-dusty-blue)", value: "2♥" },
  { label: "Missing home", icon: "house", tone: "var(--accent-ochre)", value: "1♥" },
  { label: "Cap and gown", icon: "cap", tone: "var(--accent-sage)", value: "3♥" },
  { label: "Moving abroad", icon: "suitcase", tone: "var(--accent-terracotta)", value: "2♥" },
  { label: "Just because", icon: "heart", tone: "var(--accent-rose)", value: "1♥" },
  { label: "Sunday calls", icon: "sun", tone: "var(--accent-ochre)", value: "1♥" },
  { label: "A hard week", icon: "moon", tone: "var(--accent-dusty-blue)", value: "2♥" },
  { label: "Get well soon", icon: "flower", tone: "var(--accent-sage)", value: "1♥" },
  { label: "Coffee for two", icon: "cup", tone: "var(--accent-terracotta)", value: "2♥" },
  { label: "A thank-you", icon: "gift", tone: "var(--accent-rose)", value: "1♥" },
  { label: "A year together", icon: "star", tone: "var(--accent-ochre)", value: "3♥" },
];

export function Occasions() {
  return (
    <section aria-labelledby="occ-title" className="section-y">
      <div className="wrap grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <p className="eyebrow text-terracotta-ink">No occasion needed</p>
          <h2 id="occ-title" className="display mt-4 text-d1">
            Though people <em>do send one</em> for all sorts.
          </h2>
          <p className="mt-5 max-w-md text-lede text-ink-soft">A birthday, a move, a hard week, a Sunday. Or no reason at all, which is often the best one.</p>
        </div>
        <InView as="ul" effect="stick" className="hm-sheet" aria-label="Some reasons people send one">
          {OCCASIONS.map((o, i) => (
            <li key={o.label} style={v({ "--i": i, "--tilt-in": `${(i % 2 ? 6 : -6)}deg` })}>
              <span className="hm-ostamp-wrap peel" style={v({ "--r": `${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg` })}>
                <span className="hm-ostamp" style={v({ "--tone": o.tone })}>
                <span className="hm-ostamp__field">
                  <span className="hm-ostamp__value" aria-hidden>
                    {o.value}
                  </span>
                  <span className="hm-ostamp__icon" aria-hidden>
                    {OCCASION_ICONS[o.icon]}
                  </span>
                  <span className="hm-ostamp__label">{o.label}</span>
                </span>
                </span>
              </span>
            </li>
          ))}
        </InView>
      </div>
    </section>
  );
}

// ─── 5. Wish you were here: written across a sunset ────────────────────────

const STICKERS: { text: string; shape: string }[] = [
  { text: "No app", shape: "hm-stk--circle" },
  { text: "No login", shape: "hm-stk--oval" },
  { text: "Codes never expire", shape: "hm-stk--label" },
  { text: "iPhone & Android", shape: "hm-stk--pennant" },
  { text: "Private by design", shape: "hm-stk--circle hm-stk--paper" },
];

export function Wish() {
  return (
    <ExpandBand aria-labelledby="wish-title" className="hm-wish band-sunset perf-edge">
      <div className="wrap section-y text-center">
        <InView as="h2" effect="write" id="wish-title" className="script hm-wish__title">
          Wish you were here.
        </InView>
        <ScrollFill className="hm-wish__fill" text="…so here is the next best thing: a letter that opens at a touch, and keeps for years." />
        <InView as="ul" effect="stick" delay={500} className="hm-stickers" aria-label="What it promises">
          {STICKERS.map((s, i) => (
            <li key={s.text} style={v({ "--i": i, "--tilt-in": `${i % 2 ? 9 : -9}deg` })}>
              <span className={`hm-stk peel ${s.shape}`} style={v({ "--r": `${[-6, 4, -2, 5, -4][i]}deg` })}>
                {s.text}
              </span>
            </li>
          ))}
        </InView>
      </div>
    </ExpandBand>
  );
}

// ─── 6–7. What fits → the first tap (pinned, after later.com) ───────────────

export function FirstTap() {
  return <HypeToTap />;
}

// ─── 8. A year in one envelope (pinned scroll story) ───────────────────────

export function Kept() {
  return <YearInEnvelope />;
}

// ─── 9. Good to know: postcard scenes and quick answers ─────────────────────

export function GoodToKnow() {
  return <GoodToKnowBento />;
}
