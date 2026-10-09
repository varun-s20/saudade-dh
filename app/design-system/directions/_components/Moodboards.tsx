/**
 * Moodboard collages for the three directions, built from our own primitives, CSS and the
 * licensed demo photos (docs/ASSETS.md). No copied imagery. Decorative (aria-hidden); each
 * board has a written description in docs/DIRECTIONS.md and on the page.
 */
import type { CSSProperties } from "react";
import photos from "@/public/demo/photos/manifest.json";
import { PhotoMount } from "@/components/media/PhotoMount";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { Postmark } from "@/components/paper/Postmark";
import { Stamp } from "@/components/stamps/Stamp";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import "./directions.css";

const ph = (n: number) => {
  const p = photos[n];
  return { src: `/demo/photos/${p.file}`, alt: "", width: p.width, height: p.height };
};

const Note = ({ children, style }: { children: string; style: CSSProperties }) => (
  <span className="absolute font-hand text-[1.125rem] leading-tight text-ink-soft" style={style}>
    {children}
  </span>
);

/** A: Sun-Bleached Postcard: faded terracotta and cream, soft grain, airy. */
export function MoodA() {
  return (
    <div className="dir-sunfade relative h-[25rem] overflow-hidden rounded-paper bg-paper sm:h-[27rem]" aria-hidden>
      <PhotoMount {...ph(0)} corners={false} rotate={-5} className="absolute top-[6%] left-[4%] w-[60%] max-w-[17rem]" />
      <div className="dir-postcard right-[3%] bottom-[7%] w-[66%] max-w-[18.5rem] rotate-[3.5deg]">
        <p className="dir-postcard__head">POST CARD</p>
        <p className="dir-postcard__msg">Wish you were here. The sea still says your name.</p>
        <div className="dir-postcard__addr">
          <span className="dir-postcard__box">
            <Stamp kind="photos" width={34} rotate={0} shadow={false} />
          </span>
          <p className="dir-postcard__line">Theo</p>
          <p className="dir-postcard__line">somewhere far</p>
          <p className="dir-postcard__line" />
        </div>
      </div>
      <Postmark variant="wavy" date="2026-07-14" place="SAUDADE" bottom="BY THE SEA" size={64} rotate={-8} className="absolute right-[1%] bottom-[41%]" ink="terracotta" />
      <div className="absolute top-[8%] right-[5%] flex flex-col gap-1.5">
        {["accent-terracotta", "paper-raised", "accent-dusty-blue", "accent-sage", "accent-rose"].map((t, i) => (
          <span key={t} className="block h-6 w-16 rounded-paper shadow-stamp" style={{ backgroundColor: `var(--${t})`, transform: `rotate(${i % 2 ? 2 : -2}deg)` }} />
        ))}
      </div>
      <Note style={{ left: "6%", bottom: "6%", transform: "rotate(-4deg)" }}>faded, warm, airy</Note>
    </div>
  );
}

/** B: Desk Drawer Ephemera: layered collage, tape, postmarks, richer texture. */
export function MoodB() {
  return (
    <div className="dir-kraft relative h-[25rem] overflow-hidden rounded-paper sm:h-[27rem]" aria-hidden>
      <span className="dir-label top-[5%] left-[5%] rotate-[-2deg]">THINGS I KEPT</span>
      <PaperSheet edge="torn" tone="aged" ruled seed={14} wrapperClassName="absolute left-[4%] top-[15%] w-[52%] rotate-[-4deg]" className="h-[11.5rem] px-4 pt-3">
        <p className="font-hand text-[1.3rem] leading-[var(--leading-letter)] text-ink-letter">Tuesday, rain.</p>
        <p className="font-hand text-[1.3rem] leading-[var(--leading-letter)] text-ink-letter">Found the ticket from our</p>
        <p className="font-hand text-[1.3rem] leading-[var(--leading-letter)] text-ink-letter">last train…</p>
      </PaperSheet>
      <svg viewBox="0 0 24 60" className="absolute top-[11%] left-[38%] h-14 w-6 rotate-[8deg] text-ink-faded" aria-hidden>
        <path d="M8 52V12a5 5 0 0 1 10 0v38a7 7 0 0 1-14 0V16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <PhotoMount {...ph(3)} rotate={6} className="absolute top-[7%] right-[5%] w-[44%] max-w-[13rem]" />
      <span className="dir-tape top-[5%] right-[16%] w-20 rotate-[8deg]" style={{ ["--tape" as string]: "var(--accent-ochre)" }} />
      <div className="absolute bottom-[7%] left-[8%]">
        <Stamp kind="song" width={86} rotate={-8} postmark={{ date: "2026-10-08" }} />
      </div>
      <div className="absolute bottom-[12%] left-[30%]">
        <Stamp kind="voice" width={78} rotate={7} isNew />
      </div>
      <div className="dir-ticket right-[6%] bottom-[22%] rotate-[-6deg]">
        <span>RETURN</span>
        <span className="dir-ticket__no">No. 0417</span>
      </div>
      <span className="dir-rubber absolute right-[9%] bottom-[7%] rotate-[-9deg]">Air mail</span>
    </div>
  );
}

/** C: Quiet Letterpress: restrained, whitespace, debossed paper, one ink. */
export function MoodC() {
  return (
    <div className="relative h-[25rem] overflow-hidden rounded-paper bg-paper-raised sm:h-[27rem]" aria-hidden>
      <div className="dir-deboss absolute top-[14%] left-[8%] flex h-[52%] w-[58%] flex-col items-center justify-center rounded-paper">
        <span className="dir-blind font-display text-[2.6rem] leading-none font-light tracking-[-0.02em] italic">Saudade</span>
        <span className="mt-3 font-ui text-[0.6875rem] tracking-[0.22em] text-ink-faded uppercase">a letter for someone you miss</span>
      </div>
      <div className="absolute top-[12%] right-[9%]">
        <Stamp kind="letter" width={70} rotate={0} postmark={{ variant: "circle" }} shadow={false} />
      </div>
      <span className="absolute top-[74%] left-[8%] h-px w-[40%] bg-paper-shadow" />
      <span className="absolute top-[78%] left-[8%] h-px w-[26%] bg-paper-shadow" />
      <PhotoMount {...ph(4)} corners={false} className="absolute right-[9%] bottom-[8%] w-[24%] max-w-[7.5rem]" />
      <HeartSeal size={34} className="absolute bottom-[10%] left-[10%]" seed={9} />
    </div>
  );
}
