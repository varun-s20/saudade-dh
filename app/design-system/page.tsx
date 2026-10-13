import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { STAMPS, HEART_SEAL, PLACEHOLDER_LABEL } from "@/config/stamps";
import { STAMP_KINDS } from "@/lib/services/types";
import { sampleLetter } from "@/lib/demo/sample";
import photos from "@/public/demo/photos/manifest.json";
import { Stamp } from "@/components/stamps/Stamp";
import { StampFrame } from "@/components/stamps/StampFrame";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { Postmark } from "@/components/paper/Postmark";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { PhotoMount } from "@/components/media/PhotoMount";
import { InkLink } from "@/components/ui/InkButton";
import { icons } from "@/components/ui/icons";
import { Cell, Grid, Section, SubHead, Tok } from "./_components/ds";
import { Swatches } from "./_components/Swatches";
import { ButtonsDemo, CodeInputDemo, FeedbackDemo, FieldsDemo, UploadDemo } from "./_components/Demos";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const CONTENTS = [
  ["colour", "Colour"],
  ["type", "Type"],
  ["shape", "Shape & depth"],
  ["paper", "Paper & texture"],
  ["stamps", "Stamps & postmarks"],
  ["photos", "Photographs"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["feedback", "Feedback"],
  ["icons", "Icons"],
  ["motion", "Motion tokens"],
] as const;

const photo = (n: number) => {
  const p = photos[n];
  return { src: `/demo/photos/${p.file}`, alt: p.alt, width: p.width, height: p.height, caption: p.caption };
};

function Cover() {
  return (
    <header className="relative grid gap-10 pt-10 pb-12 md:grid-cols-[1.15fr_1fr] md:items-center md:pt-16 md:pb-16">
      <div>
        <p className="tag">Saudade · Design system · Phase 1</p>
        <h1 className="display mt-5 text-[2.75rem] text-ink md:text-[4.25rem]">
          Stationery
          <br />
          <em>&amp; postage</em>
        </h1>
        <p className="mt-5 max-w-[34rem] text-[1rem] leading-relaxed text-ink-soft">
          The tokens and primitives the letter is made of (direction F, Wish You Were Here): a 1940s linen postcard. Turquoise sky and sunset gradients on a woven weave, large-letter block capitals with a script hand, white-bordered postcards, perforated edges, postmarks and a wax heart. Every value comes from{" "}
          <Tok>styles/tokens.css</Tok>; every stamp from <Tok>config/stamps.ts</Tok>.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
          <InkLink href="/design-system/directions">See the directions</InkLink>
          <InkLink href="/design-system/motion" variant="quiet">
            Motion studies
          </InkLink>
        </div>
      </div>

      {/* A small collage, built from the primitives themselves. */}
      <div className="relative mx-auto h-[19rem] w-full max-w-[22rem] md:h-[24rem] md:max-w-[26rem]" aria-hidden>
        <PaperSheet edge="deckled" tone="aged" ruled seed={11} wrapperClassName="absolute left-[6%] top-[8%] w-[70%] rotate-[-4deg]" className="h-[15rem] px-5 pt-6 md:h-[18rem]">
          <p className="font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">Dear Theo,</p>
          <p className="font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">It&apos;s raining here…</p>
        </PaperSheet>
        <div className="absolute right-[14%] top-0 md:right-[10%]">
          <Stamp kind="photos" width={118} rotate={6} postmark={{ date: "2026-10-08" }} priority />
        </div>
        <div className="absolute bottom-[4%] right-[14%]">
          <Stamp kind="song" width={104} rotate={-7} />
        </div>
        <HeartSeal size={74} className="absolute bottom-[10%] left-[10%]" glow />
      </div>
    </header>
  );
}

function Contents() {
  return (
    <nav aria-label="Contents" className="pb-6">
      <ol className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENTS.map(([id, label], i) => (
          <li key={id}>
            <a href={`#${id}`} className="flex min-h-[var(--tap-min)] items-end py-1.5 text-ink no-underline hover:text-terracotta-ink">
              <span className="font-display text-[1.0625rem]">{label}</span>
              <span className="ds-leader" aria-hidden />
              <span className="postal-label text-ink-faded">No. {String(i + 1).padStart(2, "0")}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PlaceholderNotice() {
  return (
    <div className="relative my-6 max-w-[40rem]">
      <PaperSheet edge="torn" seed={5} className="px-5 pt-5 pb-7" role="note" aria-label="Placeholder artwork notice">
        <p className="postal-label text-red-ink">{PLACEHOLDER_LABEL}</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Every stamp and the heart seal on these pages are <strong className="font-semibold text-ink">original placeholders</strong> drawn by the team, each printed with a
          “PLACEHOLDER” mark. The client&apos;s artwork replaces them in <Tok>config/stamps.ts</Tok> and nowhere else; frames, postmarks and the wax seal are built to receive it.
        </p>
      </PaperSheet>
      <span
        aria-hidden
        className="absolute -top-2 left-8 h-5 w-24 rotate-[-4deg] mix-blend-multiply"
        style={{ background: "color-mix(in srgb, var(--accent-rose) 60%, transparent)" }}
      />
    </div>
  );
}

function TypeSection() {
  return (
    <Section id="type" no="02" title="Type" lede="Three faces (D-082): large-letter block capitals for headlines, a real-pen handwriting for the letter and the word that carries the feeling, and a warm humanist sans for everything you read and tap, labels included. All OFL; swap the loaders in app/fonts.ts.">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <SubHead note="Bowlby One · --ff-display · the display utility (uppercase)">Display</SubHead>
          <p className="display text-[2.75rem] text-ink">Someone who misses you <em>sent this.</em></p>
          <p className="display mt-4 text-[1.75rem] text-ink">A letter for someone you miss.</p>
          <p className="mt-3 text-[0.8125rem] text-ink-faded">
            44 / 28px. Headlines and numbers, always in capitals. An <Tok>&lt;em&gt;</Tok> inside switches to the script hand in post-box red (ochre on
            the blue bands).
          </p>

          <SubHead note="Nanum Pen Script · --ff-script · the script utility (scaled by --fsa-script)">Script</SubHead>
          <p className="script text-[2.6rem] text-navy">Greetings from someone who misses you</p>
          <p className="mt-3 text-[0.8125rem] text-ink-faded">
            The &ldquo;Greetings from&rdquo; line, the recipient&apos;s prompt, and the paired word in headings. One phrase at a time, never paragraphs.
          </p>

          <SubHead note="Karla, tracked capitals · --ff-postal · labels and codes only">Postal</SubHead>
          <p className="font-postal text-[1.75rem] tracking-[0.06em] text-ink">SAUD-3K7M</p>
          <p className="postal-label mt-2 text-postmark">No. 1 · Photographs · 08 Oct 2026</p>
          <p className="mt-3 text-[0.8125rem] text-ink-faded">
            Codes, postmarks, labels. Use the <Tok>postal-label</Tok> utility; never for sentences.
          </p>

          <SubHead note="Karla · --ff-ui">UI</SubHead>
          <p className="text-[1rem] leading-relaxed text-ink">Only for sending you your private link. Never shared, never used for anything else.</p>
          <p className="mt-2 text-[0.875rem] text-ink-soft">Forms, hints, admin tables. 14–16px.</p>
        </div>

        <div>
          <SubHead note="Nanum Pen Script · --ff-hand · 30px / 1.4, ink-letter on aged paper">Handwriting: the letter</SubHead>
          <PaperSheet edge="deckled" tone="aged" ruled className="px-6 pt-6 pb-8" seed={9}>
            <p className="font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">Dear {sampleLetter.to},</p>
            {sampleLetter.body
              .split("\n\n")
              .slice(0, 2)
              .map((para) => (
                <p key={para.slice(0, 12)} className="indent-8 font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">
                  {para}
                </p>
              ))}
            <p className="mt-0 font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">{sampleLetter.signoff}</p>
            <p className="font-hand text-[2rem] leading-[var(--leading-letter)] text-ink-letter">{sampleLetter.from}</p>
          </PaperSheet>
          <div className="mt-6 space-y-2 text-[0.875rem] text-ink-soft">
            <p className="font-hand text-[length:var(--text-letter)] leading-snug text-ink-letter" lang="ru">
              Я скучаю по тебе. <span className="text-[0.8125rem] font-ui text-ink-faded">(Cyrillic: readable serif fallback)</span>
            </p>
            <p lang="ja" style={{ fontFamily: "var(--ff-hand-fallback)" } as CSSProperties} className="text-[1.25rem] text-ink-letter">
              あなたに会いたい。 <span className="font-ui text-[0.8125rem] text-ink-faded">(CJK and other scripts: readable serif fallback, never a cursive-only face)</span>
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ShapeSection() {
  const radii = [
    ["paper", "4px · paper, stamps, envelopes"],
    ["soft", "10px · fields, focus ring, code boxes"],
    ["card", "14px · postcards, panels, sheets"],
    ["sheet", "22px · bottom sheet top"],
    ["pill", "999px · buttons, tags, tab rails"],
  ] as const;
  const elev = [
    ["flat", "--elev-flat"],
    ["paper", "--elev-paper"],
    ["stamp", "--elev-stamp"],
    ["lifted", "--elev-lifted"],
    ["envelope", "--elev-envelope"],
    ["sheet", "--elev-sheet"],
  ] as const;
  const z = ["base 0", "envelope 10", "stamps 20", "header 30", "sheet 50", "modal 60", "toast 70", "demo 90"];
  return (
    <Section id="shape" no="03" title="Shape & depth" lede="Postcards have softly rounded corners and a white border; paper and stamps stay nearly square. Two kinds of depth: a soft warm shadow for things resting on the desk, and a hard navy offset (the gumroad.com reference) for things you can press. Perforated edges are masks, so the shadow follows the edge.">
      <SubHead>Radii</SubHead>
      <Grid className="lg:grid-cols-5">
        {radii.map(([k, note]) => (
          <Cell key={k} label={`--r-${k}`} note={note}>
            <div className="h-16 w-24 border-[1.5px] border-ink-soft bg-paper-raised" style={{ borderRadius: `var(--r-${k})` }} />
          </Cell>
        ))}
      </Grid>
      <SubHead note="Box shadows for rectangles; *-drop filters for perforated, deckled and ticket shapes.">Elevation</SubHead>
      <Grid className="lg:grid-cols-6">
        {elev.map(([k, t]) => (
          <Cell key={k} label={k} note={t}>
            <div className="h-16 w-20 rounded-paper bg-paper-raised" style={{ boxShadow: `var(${t})` }} />
          </Cell>
        ))}
        <Cell label="stamp-drop" note="--elev-stamp-drop">
          <StampFrame width={64}>
            <div className="ds-chip bg-paper-deep" />
          </StampFrame>
        </Cell>
        <Cell label="paper-drop" note="--elev-paper-drop">
          <PaperSheet edge="deckled" className="h-16 w-20" seed={2}>
            {null}
          </PaperSheet>
        </Cell>
      </Grid>
      <SubHead note="Mirrored in lib/tokens.ts for Motion.">Layering</SubHead>
      <ol className="flex flex-wrap gap-2">
        {z.map((v) => (
          <li key={v} className="postal-label rounded-paper border border-paper-edge/70 bg-paper-raised px-2.5 py-1.5 text-ink-soft">
            --z-{v}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function PaperSection() {
  return (
    <Section id="paper" no="04" title="Paper & texture" lede="All textures are self-made SVG noise (feTurbulence), tiled and tiny. They sit under the content and never reduce contrast.">
      <SubHead>Textures</SubHead>
      <Grid>
        <Cell label="grain" note="--texture-grain · on every page (shown 4× stronger)">
          <div className="h-20 w-full rounded-paper bg-paper-raised" style={{ backgroundImage: "var(--texture-grain), var(--texture-grain), var(--texture-grain), var(--texture-grain)" }} />
        </Cell>
        <Cell label="fibre" note="--texture-fibre · letter, envelope (shown 4× stronger)">
          <div className="h-20 w-full rounded-paper bg-paper-raised" style={{ backgroundImage: "var(--texture-fibre), var(--texture-fibre), var(--texture-fibre), var(--texture-fibre)", backgroundSize: "400px 400px" }} />
        </Cell>
        <Cell label="ink speckle" note="--texture-ink · mask for stamped ink">
          <div className="ds-ink-block h-20 w-full rounded-paper" />
        </Cell>
        <Cell label="desk" note="--desk · desktop surround">
          <div className="ds-desk h-20 w-full rounded-paper" />
        </Cell>
      </Grid>
      <SubHead note="as, ruled, margin, edge clean | deckled | torn, tone raised | aged">PaperSheet</SubHead>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="clean · raised" bodyClassName="p-4">
          <PaperSheet className="h-40 w-full p-4">
            <p className="postal-label text-ink-faded">Fresh sheet</p>
          </PaperSheet>
        </Cell>
        <Cell label="deckled · aged · ruled" bodyClassName="p-4">
          <PaperSheet edge="deckled" tone="aged" ruled className="h-40 w-full px-4 pt-3" wrapperClassName="w-full" seed={4}>
            <p className="font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">On the lines.</p>
          </PaperSheet>
        </Cell>
        <Cell label="torn · margin" bodyClassName="p-4">
          <PaperSheet edge="torn" ruled margin className="h-40 w-full pt-3 pr-3 pl-12" wrapperClassName="w-full" seed={8}>
            <p className="font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">Torn from a pad.</p>
          </PaperSheet>
        </Cell>
        <Cell label="aged · clean · no shadow" note="On the desk" bodyClassName="ds-desk p-4">
          <PaperSheet tone="aged" shadow={false} className="h-40 w-full p-4">
            <p className="postal-label text-ink-faded">Foxing &amp; tan edge</p>
          </PaperSheet>
        </Cell>
      </div>
    </Section>
  );
}

function StampsSection() {
  return (
    <Section
      id="stamps"
      no="05"
      title="Stamps & postmarks"
      lede={
        <>
          Four small worlds, one postal system: each stamp has its own ink and motif, but shares the frame, the perforation and the postmark grammar. Art comes only from{" "}
          <Tok>STAMPS[kind].art</Tok>. These are <strong className="font-semibold text-red-ink">placeholders</strong>.
        </>
      }
    >
      <SubHead note="Resting rotation from config · 132px">The set</SubHead>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-8">
        {STAMP_KINDS.map((k) => (
          <figure key={k} className="m-0 flex flex-col items-start gap-3">
            <Stamp kind={k} />
            <figcaption>
              <span className="block font-display text-[1rem] text-ink">{STAMPS[k].label}</span>
              <span className="postal-label block text-ink-faded">
                {STAMPS[k].accent} · {STAMPS[k].motif}
              </span>
            </figcaption>
          </figure>
        ))}
        <figure className="m-0 flex flex-col items-start gap-3">
          <div className="grid h-[165px] w-[132px] place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- asset-map art shown raw */}
            <img src={HEART_SEAL.src} alt="" width={120} height={120} style={{ filter: "var(--elev-stamp-drop)" }} />
          </div>
          <figcaption>
            <span className="block font-display text-[1rem] text-ink">Heart stamp</span>
            <span className="postal-label block text-ink-faded">mirrors the NFC tap zone</span>
          </figcaption>
        </figure>
      </div>

      <SubHead>States</SubHead>
      <Grid className="lg:grid-cols-4">
        <Cell label="postmarked" note="Wavy cancellation + date" bodyClassName="py-8">
          <Stamp kind="letter" rotate={2} postmark={{ date: "2026-10-08" }} />
        </Cell>
        <Cell label="circle postmark" note="Undated: heart in the band" bodyClassName="py-8">
          <Stamp kind="voice" rotate={-2} postmark={{ variant: "circle" }} />
        </Cell>
        <Cell label="isNew" note="Updated since last visit [PROPOSED]" bodyClassName="py-8">
          <Stamp kind="song" isNew />
        </Cell>
        <Cell label="empty" note="Sender portal: nothing yet" bodyClassName="py-8">
          <Stamp kind="photos" empty emptyLabel="Photos" />
        </Cell>
      </Grid>

      <SubHead>Sizes</SubHead>
      <div className="flex flex-wrap items-end gap-6">
        <Stamp kind="photos" width={72} rotate={0} />
        <Stamp kind="photos" width={104} rotate={0} />
        <Stamp kind="photos" width={132} rotate={0} />
        <Stamp kind="photos" width={200} rotate={0} />
      </div>
      <p className="mt-3 text-[0.8125rem] text-ink-faded">72 / 104 / 132 / 200px. Perforation pitch and margin scale with width. The placeholder art carries its own printed mark; from 200px the frame adds one in the margin too.</p>

      <SubHead note="date, place, bottom, variant circle | wavy | new, ink postmark | red | terracotta">Postmark</SubHead>
      <Grid className="lg:grid-cols-4">
        <Cell label="circle · dated">
          <Postmark date="2026-10-08" place="SAUDADE · BY HAND" />
        </Cell>
        <Cell label="circle · undated · terracotta">
          <Postmark place="SNAPSHOTS" bottom="SAUDADE" ink="terracotta" rotate={-8} />
        </Cell>
        <Cell label="new · red" note="Small, for updates">
          <Postmark variant="new" size={64} rotate={8} />
        </Cell>
        <Cell label="wavy" className="col-span-2 sm:col-span-3 lg:col-span-1" bodyClassName="overflow-hidden">
          <Postmark variant="wavy" date="2026-10-08" place="ON THE AIR" bottom="SAUDADE" size={78} />
        </Cell>
      </Grid>

      <SubHead note="size, glow, pressed. The heart is the HEART_SEAL art, pressed into the wax.">HeartSeal</SubHead>
      <Grid className="lg:grid-cols-4">
        <Cell label="resting · 72" bodyClassName="py-8">
          <HeartSeal />
        </Cell>
        <Cell label="glow" note="Waiting for the tap · still under reduced motion" bodyClassName="py-8">
          <HeartSeal glow size={80} />
        </Cell>
        <Cell label="pressed" note="Seal & send" bodyClassName="py-8">
          <HeartSeal pressed size={80} seed={12} />
        </Cell>
        <Cell label="sizes 44 / 56" bodyClassName="gap-5 py-8">
          <HeartSeal size={44} seed={3} />
          <HeartSeal size={56} seed={5} />
        </Cell>
        <Cell label="detail · 168" className="col-span-2" bodyClassName="py-8">
          <HeartSeal size={168} seed={21} />
        </Cell>
      </Grid>
    </Section>
  );
}

function PhotosSection() {
  const a = photo(0);
  const b = photo(2);
  const c = photo(5);
  return (
    <Section id="photos" no="06" title="Photographs" lede="A snapshot tucked into an album page: worn print border, corner pockets or a strip of washi tape, the caption written underneath. The print is gently sun-bleached in CSS; the original file is untouched.">
      <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-3">
        <PhotoMount {...a} rotate={-2} className="mx-auto w-full max-w-[19rem]" />
        <PhotoMount {...b} rotate={1.5} tape corners={false} className="mx-auto w-full max-w-[14rem]" />
        <PhotoMount {...c} rotate={-1} tape="terracotta" className="mx-auto w-full max-w-[19rem]" />
      </div>
      <p className="mt-6 text-[0.8125rem] text-ink-faded">Photos from Unsplash (see docs/ASSETS.md). Plain &lt;img&gt;, so blob: previews from the sender&apos;s phone work too.</p>
    </Section>
  );
}

function IconsSection() {
  return (
    <Section id="icons" no="10" title="Icons" lede="Original stroke drawings on a 24px grid, currentColor, 1.75 stroke, drawn a touch loose. Decorative by default; give the button an aria-label.">
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-6 lg:grid-cols-11" role="list">
        {Object.entries(icons).map(([name, Icon]) => (
          <li key={name} className="flex flex-col items-center gap-2 text-ink">
            <span className="ds-cell grid size-14 place-items-center">
              <Icon />
            </span>
            <span className="text-center font-postal text-[0.625rem] tracking-[0.06em] text-ink-faded">{name}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MotionSection() {
  const durs = [
    ["instant", "100ms"],
    ["fast", "180ms"],
    ["base", "280ms"],
    ["slow", "480ms"],
    ["ceremony", "900ms"],
  ];
  const eases = [
    ["out", "0.22, 1, 0.36, 1"],
    ["in-out", "0.65, 0, 0.35, 1"],
    ["paper", "0.3, 0.7, 0.2, 1"],
    ["press", "0.55, 0, 0.75, 0.2"],
  ];
  return (
    <Section id="motion" no="11" title="Motion tokens" lede="Durations and curves only; the choreography lives with the Motion Designer. Animate transform and opacity; every loop on this page has a still reduced-motion state.">
      <div className="grid gap-10 sm:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {durs.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-postal text-[0.8125rem] text-ink-soft">--motion-dur-{k}</dt>
              <dd className="m-0 text-[0.875rem] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {eases.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-postal text-[0.8125rem] text-ink-soft">--motion-ease-{k}</dt>
              <dd className="m-0 text-[0.875rem] text-ink">cubic-bezier({v})</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-8">
        <InkLink href="/design-system/motion" variant="secondary">
          Open the motion studies
        </InkLink>
      </div>
    </Section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-full max-w-[76rem] overflow-x-clip px-4 pb-24 md:px-10">
      <Cover />
      <Contents />
      <PlaceholderNotice />

      <Section id="colour" no="01" title="Colour" lede="Wish You Were Here: sepia ink on linen cream, one post-box red for every call to action, navy for type that sits on colour, a turquoise sky and a deep sea for full-bleed bands, a mustard-to-coral sunset, and five pastel stamp worlds. Fills are decorative; text uses the “-ink” partners. Values and ratios below are read live from the tokens.">
        <Swatches />
      </Section>

      <TypeSection />
      <ShapeSection />
      <PaperSection />
      <StampsSection />
      <PhotosSection />

      <Section id="buttons" no="07" title="Buttons" lede="Square poster tickets with the bottom-right corner clipped and a trailing arrow on links. Hover lifts the ticket onto a hard ink shadow; press lands it. Vermilion for the main action, ink, cream and outlined for the rest.">
        <ButtonsDemo />
      </Section>

      <Section id="forms" no="08" title="Forms" lede="Filling in a postcard, not a SaaS form: typewriter labels, a ruled writing line that inks in on focus, plain error messages.">
        <SubHead note="StampedInput · StampedTextarea">Fields</SubHead>
        <FieldsDemo />
        <SubHead note="Ambiguous characters are refused at the keystroke, with a gentle hint.">CodeInput</SubHead>
        <CodeInputDemo />
        <SubHead>UploadTile</SubHead>
        <UploadDemo />
      </Section>

      <Section id="feedback" no="09" title="Feedback" lede="Progress is a postmark being inked; waiting is an ink dot travelling the ring; notices arrive as small postal slips.">
        <FeedbackDemo />
      </Section>

      <IconsSection />
      <MotionSection />
    </main>
  );
}
