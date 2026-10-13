import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LargeLetters } from "@/components/motion/LargeLetters";
import { Stamp } from "@/components/stamps/Stamp";
import { InkLink } from "@/components/ui/InkButton";
import { cn } from "@/lib/utils/cn";
import { Palette, type PaletteChip } from "./_components/Palette";
import { MoodA, MoodB, MoodC } from "./_components/Moodboards";
import { HeroA, HeroB, HeroC } from "./_components/HeroFrames";
import "../_components/ds.css";
import "./_components/directions.css";

export const metadata: Metadata = {
  title: "Design directions",
  robots: { index: false, follow: false },
};

interface DirectionProps {
  id: string;
  letter: string;
  name: string;
  concept: string;
  recommended?: boolean;
  alternative?: boolean;
  mood: ReactNode;
  moodNote: string;
  palette: PaletteChip[];
  type: ReactNode;
  hero: ReactNode;
  reads: string[];
  risks: string[];
}

function Direction({ id, letter, name, concept, recommended, alternative, mood, moodNote, palette, type, hero, reads, risks }: DirectionProps) {
  return (
    <article id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 pt-10 pb-16">
      <div className="ds-perf mb-10" aria-hidden />
      <header className="relative mb-8 grid grid-cols-[auto_1fr] items-end gap-x-5 gap-y-3 md:gap-x-7">
        <span className="font-display text-[4.5rem] leading-[0.8] font-light text-terracotta-ink italic md:text-[6.5rem]" aria-hidden>
          {letter}
        </span>
        <div className="min-w-0">
          <p className="postal-label text-ink-faded">Direction {letter}</p>
          <h2 id={`${id}-title`} className="mt-1 font-display text-[2rem] leading-[1.05] tracking-[-0.01em] text-ink md:text-[2.75rem]">
            {name}
          </h2>
        </div>
        <p className="col-span-2 max-w-[40rem] text-[0.9375rem] leading-relaxed text-ink-soft md:col-start-2">{concept}</p>
        {(recommended || alternative) && (
          <span
            className={cn("dir-rubber col-span-2 mt-2 justify-self-start md:absolute md:top-4 md:right-0 md:mt-0", recommended ? "rotate-[-6deg]" : "rotate-[4deg]")}
            style={alternative ? { color: "var(--postmark)" } : undefined}
          >
            {recommended ? "Recommended" : "Alternative"}
          </span>
        )}
      </header>

      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
        <div className="min-w-0">
          {mood}
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-faded">{moodNote}</p>

          <h3 className="mt-10 mb-4 font-display text-[1.25rem] text-ink">Palette</h3>
          <Palette chips={palette} />

          <h3 className="mt-10 mb-4 font-display text-[1.25rem] text-ink">Type pairing</h3>
          <div className="ds-cell p-5">{type}</div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="postal-label mb-3 text-success">Against the brief</h3>
              <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-soft">
                {reads.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span aria-hidden className="text-success">+</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="postal-label mb-3 text-danger">Risks</h3>
              <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-soft">
                {risks.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span aria-hidden className="text-danger">–</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">{hero}</div>
      </div>
    </article>
  );
}

const PALETTE_F: PaletteChip[] = [
  { token: "paper", name: "Linen cream", role: "Page ground, woven texture" },
  { token: "ink", name: "Sepia ink", role: "Text" },
  { token: "accent-navy", name: "Postcard navy", role: "Type on colour, hard shadows" },
  { token: "accent-red", name: "Post-box red", role: "Every main call to action, script words" },
  { token: "accent-sky", name: "Linen sky", role: "Sky gradient, hero bands" },
  { token: "accent-cobalt", name: "Deep sea", role: "Sea bands, the recipient's desk" },
  { token: "accent-terracotta", name: "Sunset coral", role: "Sunset gradient, Photos world" },
  { token: "accent-ochre", name: "Mustard", role: "Script on turquoise, the sun, Song world" },
];

/** Direction F's moodboard: a large-letter postcard built from the live primitives. */
function MoodF() {
  return (
    <div className="postcard rotate-[-1.5deg]">
      <div className="band-sky relative overflow-hidden rounded-[calc(var(--r-card)-6px)] px-5 pt-8 pb-10 text-center">
        <p className="script text-[2rem] text-navy">Greetings from</p>
        <LargeLetters word="Saudade" photos={["/demo/photos/01.jpg", "/demo/photos/05.jpg", "/demo/photos/03.jpg"]} className="text-[clamp(2.6rem,1.5rem+4vw,4.6rem)]" />
        <div className="absolute right-4 bottom-3 rotate-[8deg]">
          <Stamp kind="photos" width={70} rotate={0} />
        </div>
      </div>
    </div>
  );
}

const PALETTE_E: PaletteChip[] = [
  { token: "paper", name: "Cream", role: "Page ground" },
  { token: "ink", name: "Warm black", role: "Text, story bands, footer" },
  { token: "accent-red", name: "Post-box vermilion", role: "Every main call to action" },
  { token: "accent-cobalt", name: "Azulejo cobalt", role: "Full-bleed bands, the reveal stage" },
  { token: "accent-vermilion", name: "Bright vermilion", role: "Dusk gradient, footer wordmark" },
  { token: "accent-lilac", name: "Dusk lilac", role: "Gradient top, tags" },
  { token: "accent-rose", name: "Candy pink", role: "Stickers, tags, the heart" },
  { token: "accent-ochre", name: "Tram yellow", role: "Tags, sticky notes, Song world" },
];

const PALETTE_D: PaletteChip[] = [
  { token: "paper", name: "Warm white", role: "Page; letter paper" },
  { token: "ink", name: "Navy postal ink", role: "All text, buttons" },
  { token: "accent-cobalt", name: "Azulejo cobalt", role: "Colour fields, the reveal stage" },
  { token: "accent-dusty-blue", name: "Tile blue", role: "Letter world, liner" },
  { token: "accent-terracotta", name: "Terracotta", role: "Accent italics, Photos world" },
  { token: "accent-sage", name: "Sea glass", role: "Voice world" },
  { token: "accent-rose", name: "Façade pink", role: "Closing band, heart" },
  { token: "accent-ochre", name: "Tram yellow", role: "Song world, the sun" },
];

const PALETTE_A: PaletteChip[] = [
  { token: "paper", name: "Cream", role: "Page, the light everything sits in" },
  { token: "paper-deep", name: "Envelope", role: "Envelope body" },
  { token: "accent-terracotta", name: "Faded terracotta", role: "Signature warmth, Photos world" },
  { token: "accent-terracotta-ink", name: "Terracotta ink", role: "Buttons, labels" },
  { token: "accent-dusty-blue", name: "Dusty blue", role: "Letter world, sky" },
  { token: "accent-sage", name: "Sage", role: "Voice world" },
  { token: "accent-rose", name: "Rose", role: "Liner, tape" },
  { token: "ink-letter", name: "Letter ink", role: "Handwriting" },
];
const PALETTE_B: PaletteChip[] = [
  { token: "desk", name: "Desk", role: "Surround" },
  { token: "paper-edge", name: "Kraft", role: "Envelope, card stock", css: "color-mix(in srgb, var(--paper-edge) 62%, var(--paper-deep))" },
  { token: "paper", name: "Aged paper", role: "Notes, letter" },
  { token: "accent-ochre", name: "Ochre", role: "Tickets, Song world" },
  { token: "accent-red", name: "Postal red", role: "Airmail, rubber stamps" },
  { token: "postmark", name: "Postmark blue", role: "Cancellations, airmail" },
  { token: "accent-sage-ink", name: "Bottle green", role: "Labels" },
  { token: "ink", name: "Ink", role: "Typewriter text" },
];
const PALETTE_C: PaletteChip[] = [
  { token: "paper-raised", name: "Cotton", role: "Page and card" },
  { token: "paper", name: "Cream", role: "Secondary surface" },
  { token: "paper-shadow", name: "Deboss shadow", role: "Blind emboss, rules" },
  { token: "postmark", name: "Postmark blue", role: "The one ink" },
  { token: "ink", name: "Ink", role: "Text" },
  { token: "ink-faded", name: "Faded ink", role: "Meta" },
  { token: "accent-terracotta", name: "Terracotta", role: "Used once: the seal, a stamp" },
  { token: "wax", name: "Wax", role: "Heart seal" },
];

const letterLine = "font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter";

export default function DirectionsPage() {
  return (
    <main className="mx-auto w-full max-w-[76rem] overflow-x-clip px-4 pb-24 md:px-10">
      <header className="pt-10 pb-8 md:pt-16">
        <p className="postal-label text-terracotta-ink">
          <Link href="/design-system" className="underline decoration-paper-edge underline-offset-4 hover:text-ink">
            Design system
          </Link>{" "}
          · Directions
        </p>
        <h1 className="display mt-4 text-[2.75rem] text-ink md:text-[4.25rem]">
          Six ways to
          <br />
          <em>write the letter</em>
        </h1>
        <p className="mt-5 max-w-[40rem] text-[1rem] leading-relaxed text-ink-soft">
          A–D stay inside the client&apos;s brief: vintage postcards, hand-stamped type, warm imperfect texture, a sun-bleached palette, postmarks and perforations. They differ in how much
          is on the page. Each board has a moodboard, palette, type pairing and one hero frame of the recipient&apos;s envelope.
        </p>
        <nav aria-label="Directions" className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
          {[
            ["f", "F · Wish You Were Here (selected)"],
            ["e", "E · Correio"],
            ["d", "D · Lisbon Post"],
            ["a", "A · Sun-Bleached Postcard"],
            ["b", "B · Desk Drawer Ephemera"],
            ["c", "C · Quiet Letterpress"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-[var(--tap-min)] items-center font-display text-[1.0625rem] text-ink underline decoration-paper-edge underline-offset-[6px] hover:text-terracotta-ink">
              {label}
            </a>
          ))}
        </nav>

        <div className="ds-cell mt-10 max-w-[48rem] p-5 md:p-7">
          <p className="postal-label text-red-ink">Selected · second revision of 9 Oct 2026</p>
          <p className="mt-2 font-display text-[1.6rem] leading-snug text-ink">
            <em>F, Wish You Were Here</em>: the 1940s linen postcard. Large-letter capitals filled with photographs, a sign-painter script, turquoise skies and
            sunsets on a woven weave, white-bordered postcards and perforated edges.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Started fresh rather than revising E, at the client&apos;s request for a new palette, a new design language and motion of its own. The same three
            references, studied for patterns only (nothing copied): later.com for clip-path reveals and tabs; gumroad.com for hard navy shadows, peeking cards
            and floating objects; oatly.com for the drum counters, the colour that fills the screen when you follow a link, stickers and labels. Motion follows
            Emil Kowalski&apos;s rules throughout. The footer is kept exactly as it was.
          </p>
          <p className="mt-6 postal-label text-ink-faded">Previous selection · morning of 9 Oct 2026</p>
          <p className="mt-2 font-display text-[1.6rem] leading-snug text-ink">
            <em>E, Correio</em>: the structure of a modern brand site, the play of a maker marketplace, the imperfection of a packaging-led brand, all in the language of the post.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Requested references, studied for patterns only (nothing copied): later.com for type hierarchy, colour discipline and layout (heavy headlines,
            notched tickets, folder tabs, extruded stat cards, angled photo crops, full-bleed bands, a giant footer wordmark); gumroad.com for play (outlined
            cards, hard shadows, floating objects, pill clouds, speech bubbles); oatly.com for imperfection (graph paper, caption-strip cards, coloured tags,
            badges, sticky notes, handwritten asides). The postal identity carries all of it: vermilion post-box red, azulejo cobalt, airmail red→blue,
            postmark wave lines, stamps, wax and the sender&apos;s handwriting. The boards below render with the live tokens.
          </p>
          <p className="mt-6 postal-label text-ink-faded">Previous selection · 8 Oct 2026</p>
          <p className="mt-2 font-display text-[1.6rem] leading-snug text-ink">
            <em>D, Lisbon Post</em>: A&apos;s calm, rebuilt with stronger colour, editorial type and a real desktop layout. Replaced by E at the client&apos;s request for a bolder, better-organised system.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Internal design review found A too beige and too quiet: brown ink on cream, four similar fonts, and a phone column on every screen. D keeps A&apos;s
            restraint but borrows from where the word saudade comes from: azulejo cobalt fields, navy postal ink, terracotta roofs, sea glass, façade pink and
            tram yellow. The boards below render with the live tokens, so A–C now show D&apos;s palette; their original palettes are recorded in DIRECTIONS.md.
          </p>
          <p className="mt-6 postal-label text-ink-faded">Original recommendation (Gate 0)</p>
          <p className="mt-2 font-display text-[1.2rem] leading-snug text-ink">
            Lead with <em>A, Sun-Bleached Postcard</em>, and let <em>B&apos;s ephemera</em> live inside the stamp worlds.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            A gives the envelope room to breathe, so the client&apos;s stamp artwork is the hero and the first-tap moment reads at a glance on a small phone. B&apos;s tape, photo corners, tickets and
            layered paper then appear where they mean something: when a stamp opens into its own world. C is beautiful but drifts towards “clean”, which the client ruled out.
          </p>
        </div>
      </header>

      <Direction
        id="f"
        letter="F"
        name="Wish You Were Here"
        recommended
        concept="A 1940s linen postcard. Large-letter block capitals that are windows onto photographs, a sign-painter script for the word that carries the feeling, turquoise skies, sunsets and a deep sea on a woven weave, white-bordered postcards with softly rounded corners, stamp perforations, postmarks and a wax heart. Buttons are pills that lift onto a hard navy shadow."
        mood={<MoodF />}
        moodNote="Rendered live with the selected tokens. References studied for patterns, never copied: later.com (clip-path reveals, tabs), gumroad.com (hard shadows, peeking cards), oatly.com (drum counters, colour that fills the screen, stickers)."
        palette={PALETTE_F}
        type={
          <div className="space-y-3">
            <p className="display text-[2.4rem] text-ink">
              Someone who misses you <em>sent this.</em>
            </p>
            <p className={letterLine}>Dear Theo, it&apos;s raining here the way it used to…</p>
            <p className="postal-label font-bold text-postmark">No. 1 · Photographs · 08 Oct 2026</p>
            <p className="text-[0.8125rem] text-ink-faded">
              Bowlby One (display) · Nanum Pen Script (the hand and the script word) · Karla (reading and labels)
            </p>
          </div>
        }
        hero={<HeroA />}
        reads={[
          "Nostalgic without being dusty: bright linen colour, big capitals, a script that smiles.",
          "Every page is a postcard: a sky or sunset masthead with a perforated edge, the work done on a postcard back.",
          "Motion with a job: letters land, postcards turn over, a rack spins on a flick, stamps stick, a postmark thunks.",
          "Readable in sunlight: sepia on linen cream, navy on colour, every call to action ≥ 5:1.",
        ]}
        risks={[
          "Photo-filled letters need short words and good photographs; keep them to one word per page.",
          "Script is for one phrase at a time; never set sentences or interface labels in it.",
        ]}
      />

      <Direction
        id="e"
        letter="E"
        name="Correio"
        concept="A bold poster-postal system. Heavy grotesque headlines on warm cream, one hot accent (post-box vermilion), azulejo cobalt and an airmail-dusk gradient as full-bleed bands, square notched tickets, extruded cards, and the sender's own handwriting wherever words are theirs."
        mood={<MoodA />}
        moodNote="Rendered live with the selected tokens. References studied for patterns, never copied: later.com (structure), gumroad.com (play), oatly.com (imperfection)."
        palette={PALETTE_E}
        type={
          <div className="space-y-3">
            <p className="display text-[2.4rem] text-ink">
              Someone who misses you <em>sent this.</em>
            </p>
            <p className={letterLine}>Dear Theo, it&apos;s raining here the way it used to…</p>
            <p className="postal-label font-bold text-postmark">No. 1 · Photographs · 08 Oct 2026</p>
            <p className="text-[0.8125rem] text-ink-faded">Epilogue 900/800 (display) · Inter Tight (UI) · Nanum Pen Script (the sender&apos;s hand) · Courier Prime (postal labels)</p>
          </div>
        }
        hero={<HeroA />}
        reads={[
          "Confident and organised: one type hierarchy, one hot accent, clear bands per section.",
          "Playful and human: pill clouds, speech bubbles, sticky notes, graph paper, scribbled asides.",
          "Still unmistakably postal: stamps, postmark waves, airmail red→blue, wax, handwriting.",
          "High contrast in sunlight: warm black on cream 16.6:1; every call to action ≥ 5:1.",
        ]}
        risks={[
          "Bolder than the brief's 'not clean or corporate': the warmth must come from the postal motifs, textures and handwriting, so keep them.",
          "Heavy display type wants short headlines; long titles wrap fast on phones.",
        ]}
      />

      <Direction
        id="d"
        letter="D"
        name="Lisbon Post"
        concept="Sun-faded Portuguese postal ephemera. Cream paper in navy postal ink, azulejo cobalt colour fields, and four pastel stamp worlds. Editorial type, a hand that looks like a real pen, and generous layouts that use the whole screen."
        mood={<MoodA />}
        moodNote="Previous selection; shown here with the live Correio tokens. Inspiration studied, never copied: Lisbon azulejos and façades, Kinfolk/Cereal editorial grids, risograph prints, Partiful's tactile print shadows, Paperless Post's envelope ceremony."
        palette={PALETTE_D}
        type={
          <div className="space-y-3">
            <p className="font-display text-[2.4rem] leading-[0.95] tracking-[-0.01em] text-ink">Someone who misses you sent this.</p>
            <p className={letterLine}>Dear Theo, it&apos;s raining here the way it used to…</p>
            <p className="postal-label font-bold text-postmark">No. 1 · Photographs · 08 Oct 2026</p>
            <p className="text-[0.8125rem] text-ink-faded">Instrument Serif (display) · Nanum Pen Script (the sender&apos;s hand) · Courier Prime (postal labels) · Bricolage Grotesque (UI)</p>
          </div>
        }
        hero={<HeroA />}
        reads={[
          "Warm and nostalgic but vivid: colour fields instead of all-over beige.",
          "Lisbon references make it ownable and tie it to the word itself.",
          "Navy ink on cream is crisp in sunlight (14:1).",
          "Responsive by design: editorial grids on desktop, calm column on phones.",
        ]}
        risks={[
          "Cobalt fields must not crowd the client's stamp art; keep them for stages and bands.",
          "Terracotta is decorative only (cream text on it is 3.3:1).",
        ]}
      />

      <Direction
        id="a"
        letter="A"
        name="Sun-Bleached Postcard"
        concept="A postcard that has sat in a sunny window: faded terracotta and cream, soft grain, generous air. Calm enough for the stamps and the handwriting to carry the feeling."
        mood={<MoodA />}
        moodNote="Moodboard: a faded seaside snapshot, the back of a vintage postcard, a terracotta cancellation and paint chips of the palette. Built from our primitives and a licensed demo photo."
        palette={PALETTE_A}
        type={
          <div className="space-y-3">
            <p className="font-display text-[2rem] leading-[1.05] tracking-[-0.01em] text-ink">Someone who misses you sent this.</p>
            <p className={letterLine}>Dear Theo, it&apos;s raining here the way it used to…</p>
            <p className="postal-label text-terracotta-ink">No. 1 · Photographs · 08 Oct 2026</p>
            <p className="text-[0.8125rem] text-ink-faded">Fraunces (soft, display) · Caveat (letter) · Special Elite (postal accents) · DM Sans (small UI)</p>
          </div>
        }
        hero={<HeroA />}
        reads={[
          "Vintage postcard, sun-bleached palette and paper grain, exactly as briefed.",
          "Airy layout keeps the client's stamp art as the hero; easy to reskin.",
          "Calm enough for repeat visits; legible on a small phone in sunlight.",
          "Warm, never corporate: hand type and imperfect ink do the work.",
        ]}
        risks={[
          "Can go too quiet if textures are dialled down; keep grain, postmarks and handwriting.",
          "Needs the four stamp worlds to bring contrast and surprise.",
        ]}
      />

      <Direction
        id="b"
        letter="B"
        name="Desk Drawer Ephemera"
        concept="The drawer where you keep the good things: kraft card, washi tape, tickets, photo corners and overlapping postmarks. Rich, tactile and personal."
        mood={<MoodB />}
        moodNote="Moodboard: a torn diary note, a photo with album corners, tape, a return ticket, an air-mail rubber stamp and two postmarked stamps on kraft."
        palette={PALETTE_B}
        type={
          <div className="space-y-3">
            <p className="font-postal text-[1.5rem] tracking-[0.08em] text-ink">FROM MIRA · 08.10.26</p>
            <p className={letterLine}>Found the ticket from our last train…</p>
            <p className="font-display text-[1.25rem] text-ink italic">things I kept for you</p>
            <p className="text-[0.8125rem] text-ink-faded">Special Elite (headings, labels) · Caveat (notes) · Fraunces italic (accents)</p>
          </div>
        }
        hero={<HeroB />}
        reads={[
          "The most tactile and nostalgic: paper, tape, postmarks, perforations everywhere.",
          "Feels hand-assembled, the furthest from tech-forward.",
          "Perfect material for the inside of each stamp world.",
        ]}
        risks={[
          "Busy on a 375px screen; the stamps compete with the collage.",
          "More layers to animate and keep at 60fps on mid-range Android.",
          "Typewriter headings tire quickly and hurt legibility in other scripts.",
        ]}
      />

      <Direction
        id="c"
        letter="C"
        name="Quiet Letterpress"
        alternative
        concept="Heavy cotton stock, blind deboss and a single postmark-blue ink. Restrained and elegant, with a lot of white space around a small cluster of stamps."
        mood={<MoodC />}
        moodNote="Moodboard: a blind-embossed card, one stamp with a single blue cancellation, hairline rules, a small print and a wax seal."
        palette={PALETTE_C}
        type={
          <div className="space-y-3">
            <p className="font-display text-[2.4rem] leading-none font-light tracking-[-0.025em] text-ink">For Theo.</p>
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">From Mira, 8 October. Tap a stamp to open it.</p>
            <p className={letterLine}>Dear Theo,</p>
            <p className="text-[0.8125rem] text-ink-faded">Fraunces Light (display) · DM Sans (body) · Caveat (letter only)</p>
          </div>
        }
        hero={<HeroC />}
        reads={[
          "Elegant and timeless; ages well and reskins easily.",
          "Fastest to build and lightest on the page.",
        ]}
        risks={[
          "Closest to “clean”, which the client explicitly ruled out.",
          "Loses the sun-bleached warmth and the sense of four different worlds.",
          "Small stamps in a corner undersell the client's artwork.",
        ]}
      />

      <div className="mt-4 flex flex-wrap gap-4">
        <InkLink href="/design-system" variant="secondary">
          Back to the design system
        </InkLink>
      </div>
    </main>
  );
}
