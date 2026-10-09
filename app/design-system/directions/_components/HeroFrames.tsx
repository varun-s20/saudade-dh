/**
 * One hero frame per direction: a phone-sized mock of the recipient's settled envelope view
 * (/t/[slug] after the first-tap reveal). Static compositions for comparison only; the real
 * screen is built by the screen engineers with the Motion Designer's <Envelope>.
 */
import type { ReactNode } from "react";
import photos from "@/public/demo/photos/manifest.json";
import { STAMPS } from "@/config/stamps";
import { STAMP_KINDS, type StampKind } from "@/lib/services/types";
import { Stamp } from "@/components/stamps/Stamp";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { Postmark } from "@/components/paper/Postmark";
import { PhotoMount } from "@/components/media/PhotoMount";
import { IconVolumeOn } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import "./directions.css";

export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className="m-0">
      <div className="dir-phone" role="img" aria-label={label}>
        <div className="dir-phone__screen">{children}</div>
      </div>
      <figcaption className="postal-label mt-4 text-center text-ink-faded">Hero frame · 375 × 812, scaled</figcaption>
    </figure>
  );
}

const POSTMARKED: Partial<Record<StampKind, { date?: string }>> = { photos: { date: "2026-10-08" }, song: {} };

/** Stamps at their resting places from config/stamps.ts. */
function PlacedStamps({ width, postmarks = true, newKind }: { width: number; postmarks?: boolean; newKind?: StampKind }) {
  return (
    <>
      {STAMP_KINDS.map((k) => (
        <div key={k} className="absolute" style={{ left: `${STAMPS[k].place.x}%`, top: `${STAMPS[k].place.y}%` }}>
          <Stamp kind={k} width={width} postmark={postmarks ? POSTMARKED[k] && { ...POSTMARKED[k] } : undefined} isNew={k === newKind} />
        </div>
      ))}
    </>
  );
}

/** Faint folded seams of the envelope's flaps, meeting where the heart seal sits. */
function EnvelopeSeams() {
  return (
    <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 size-full text-paper-shadow" aria-hidden focusable="false">
      <path d="M0 0L50 118L100 0M0 125L38 96M100 125L62 96" fill="none" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TopBar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-5 pt-11", className)}>
      <span className="postal-label">Saudade</span>
      <IconVolumeOn size={18} />
    </div>
  );
}

/** A: cream page, faded terracotta, airy spacing, soft-shadowed envelope. */
export function HeroA() {
  return (
    <PhoneFrame label="Direction A hero frame: a cream page with a pale envelope covered in four postmarked stamps and a wax heart seal">
      <div className="dir-sunfade flex h-full flex-col bg-paper">
        <TopBar className="text-ink-faded" />
        <div className="px-6 pt-4 text-center">
          <p className="postal-label text-terracotta-ink">For Theo · from Mira</p>
          <p className="mt-2 font-display text-[1.6rem] leading-[1.1] tracking-[-0.01em] text-ink">Someone who misses you sent this.</p>
        </div>
        <div className="px-5 pt-6">
          <div className="dir-env dir-env--a">
            <EnvelopeSeams />
            <PlacedStamps width={80} newKind="letter" />
            <HeartSeal size={54} glow className="absolute -bottom-5 left-1/2 -translate-x-1/2" />
          </div>
        </div>
        <p className="mt-9 text-center font-hand text-[1.4rem] text-ink-letter">Tap a stamp to open it.</p>
      </div>
    </PhoneFrame>
  );
}

/** B: kraft desk, airmail envelope, things tucked behind it, typewriter header. */
export function HeroB() {
  const p = photos[1];
  return (
    <PhoneFrame label="Direction B hero frame: a kraft desk with an airmail envelope, a photo and a torn note tucked behind it, and four overlapping stamps">
      <div className="dir-desk flex h-full flex-col">
        <TopBar className="text-ink-soft" />
        <div className="px-6 pt-3">
          <p className="font-postal text-[1.05rem] tracking-[0.08em] text-ink">FROM MIRA · 08.10.26</p>
          <p className="mt-1 font-hand text-[1.35rem] leading-tight text-ink-letter">for Theo, who is too far away</p>
        </div>
        <div className="relative px-5 pt-9">
          <PhotoMount src={`/demo/photos/${p.file}`} alt="" width={p.width} height={p.height} rotate={-9} corners={false} className="absolute top-3 left-1 z-0 w-[40%]" />
          <PaperSheet edge="torn" tone="aged" ruled seed={22} wrapperClassName="absolute right-1 bottom-[-1.5rem] z-0 w-[48%] rotate-[5deg]" className="h-24 px-3 pt-1">
            <p className="font-hand text-[1.1rem] leading-[1.6rem] text-ink-letter">see you soon?</p>
          </PaperSheet>
          <div className="dir-env dir-env--b dir-kraft relative z-10">
            <span className="dir-airmail" />
            <PlacedStamps width={82} />
            <span className="dir-rubber absolute bottom-[7%] left-[9%] rotate-[-7deg] text-[0.7rem]">Par avion</span>
            <span className="dir-tape -top-2 right-6 w-16 rotate-[10deg]" style={{ ["--tape" as string]: "var(--accent-ochre)" }} />
            <HeartSeal size={50} className="absolute -bottom-4 left-1/2 -translate-x-1/2" seed={4} />
          </div>
        </div>
        <p className="mt-10 text-center font-postal text-[0.8125rem] tracking-[0.12em] text-ink-soft uppercase">Tap a stamp to open it</p>
      </div>
    </PhoneFrame>
  );
}

/** C: near-white, debossed envelope, stamps in a tidy corner, one ink. */
export function HeroC() {
  return (
    <PhoneFrame label="Direction C hero frame: a near-white page with a debossed envelope, four small stamps in its corner and a single blue postmark">
      <div className="flex h-full flex-col bg-paper-raised">
        <TopBar className="text-ink-faded" />
        <div className="px-7 pt-10">
          <p className="font-display text-[2.4rem] leading-none font-light tracking-[-0.025em] text-ink">For Theo.</p>
          <p className="mt-3 text-[0.8125rem] tracking-[0.02em] text-ink-faded">From Mira · 8 October</p>
        </div>
        <div className="px-6 pt-9">
          <div className="dir-env dir-env--c dir-deboss dir-deboss--frame bg-paper">
            <div className="absolute top-[6%] right-[5%] grid grid-cols-2 gap-1.5">
              {STAMP_KINDS.map((k) => (
                <Stamp key={k} kind={k} width={52} rotate={0} shadow={false} />
              ))}
            </div>
            <Postmark variant="wavy" wavySide="left" size={50} place="SAUDADE" bottom="BY HAND" date="2026-10-08" className="absolute top-[9%] right-[3%]" rotate={-4} />
            <span className="dir-blind absolute bottom-[22%] left-[10%] font-display text-[2.2rem] font-light italic">Theo</span>
            <HeartSeal size={44} className="absolute bottom-[8%] left-[10%]" seed={2} />
          </div>
        </div>
        <p className="mt-8 text-center text-[0.875rem] text-ink-soft">Tap a stamp to open it</p>
      </div>
    </PhoneFrame>
  );
}
