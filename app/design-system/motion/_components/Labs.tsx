"use client";

import { useAnimationFrame, useMotionValue } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StampKind } from "@/lib/services/types";
import { STAMPS } from "@/config/stamps";
import { Envelope, type EnvelopeState } from "@/components/envelope/Envelope";
import { EnvelopeView } from "@/components/envelope/EnvelopeView";
import { Sheet } from "@/components/ui/Sheet";
import { Vinyl } from "@/components/media/Vinyl";
import { VoiceObject } from "@/components/media/VoiceObject";
import song from "@/public/demo/song.json";

export function LabSection({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-paper-shadow py-10">
      <div className="phone-column lg:max-w-5xl">
        <h2 id={id} className="font-display text-2xl text-ink">
          {title}
        </h2>
        {note ? <p className="mt-1 max-w-prose text-sm text-ink-soft">{note}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Pill({ pressed, onClick, children, id }: { pressed?: boolean; onClick: () => void; children: ReactNode; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="tap-target rounded-pill border border-paper-edge bg-paper-raised px-4 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-ink-inverse"
    >
      {children}
    </button>
  );
}

/** Envelope poses and the declarative transitions (opening, sealing). */
export function EnvelopeStatesLab() {
  const [state, setState] = useState<EnvelopeState>("closed");
  const [settled, setSettled] = useState<string>("closed");
  return (
    <div className="grid gap-8 sm:grid-cols-3">
      <figure className="space-y-3">
        <Envelope state="closed" glow toName="Theo" className="w-full" />
        <figcaption className="postal-label text-ink-faded">Closed · seal glowing</figcaption>
      </figure>
      <figure className="space-y-3 pt-[44%]">
        <Envelope state="open" className="w-full" />
        <figcaption className="postal-label text-ink-faded">Open · liner showing</figcaption>
      </figure>
      <figure className="space-y-3">
        <div className="pt-[44%]">
          <Envelope state={state} toName="Theo" onStateSettled={(s) => setSettled(s)} className="w-full" />
        </div>
        <figcaption className="flex flex-wrap items-center gap-2">
          <Pill id="env-open" onClick={() => setState("opening")}>
            Open
          </Pill>
          <Pill id="env-seal" onClick={() => setState("sealing")}>
            Seal
          </Pill>
          <span className="postal-label text-ink-faded" aria-live="polite">
            {settled}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/** Repeat visit: the calm entrance, NEW marks, and stamp worlds opening from their stamp. */
export function EnvelopeViewLab() {
  const [run, setRun] = useState(0);
  const [openKind, setOpenKind] = useState<StampKind | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <div className="h-[740px] w-full max-w-[390px] overflow-hidden rounded-[2rem] shadow-envelope ring-8 ring-ink/85">
        <EnvelopeView
          key={run}
          contained
          kinds={["photos", "letter", "voice", "song"]}
          newKinds={new Set<StampKind>(["voice", "song"])}
          toName="Theo"
          fromName="Mira"
          postmarkDate="2026-10-08"
          details={{ voice: "1 minute 12 seconds", song: "Here Comes the Sun" }}
          onOpenStamp={(k, rect) => {
            setOrigin(rect);
            setOpenKind(k);
          }}
        />
      </div>
      <div className="space-y-3">
        <Pill id="view-replay" onClick={() => setRun((n) => n + 1)}>
          Replay calm entrance
        </Pill>
        <p className="max-w-xs text-sm text-ink-soft">Tap a stamp: its world grows out of the stamp and folds back into it on close.</p>
      </div>
      <Sheet
        open={openKind !== null}
        onClose={() => setOpenKind(null)}
        title={openKind ? STAMPS[openKind].label : ""}
        accent={openKind ? STAMPS[openKind].accent : undefined}
        originRect={origin}
      >
        {openKind ? <WorldStub kind={openKind} /> : null}
      </Sheet>
    </div>
  );
}

function WorldStub({ kind }: { kind: StampKind }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-8">
      {kind === "song" ? <Vinyl playing={playing} artworkUrl={song.appleMusic.artwork.replace("100x100bb", "600x600bb")} title={song.appleMusic.title} artist={song.appleMusic.artist} size={260} /> : null}
      {kind === "voice" ? <VoiceObject playing={playing} size={200} /> : null}
      {kind === "song" || kind === "voice" ? (
        <Pill pressed={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </Pill>
      ) : (
        <p className="max-w-xs text-center font-hand text-[length:var(--text-letter)] leading-[var(--leading-letter)] text-ink-letter">
          {kind === "letter" ? "The letter world is built by the screen engineer. This is the Sheet it lives in." : "The photo world lives here: snapshots, captions, swipe."}
        </p>
      )}
    </div>
  );
}

/** Sheets without an origin: the generic bottom sheet and a plain world. */
export function SheetLab() {
  const [open, setOpen] = useState<"sheet" | "world" | null>(null);
  return (
    <div className="flex flex-wrap gap-3">
      <Pill id="open-sheet" onClick={() => setOpen("sheet")}>
        Open bottom sheet
      </Pill>
      <Pill id="open-world" onClick={() => setOpen("world")}>
        Open world (no origin)
      </Pill>
      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        variant={open ?? "sheet"}
        title={open === "world" ? "A stamp world" : "Lost your link?"}
        description={open === "sheet" ? "Drag down, press Esc or tap outside to close." : undefined}
        accent={open === "world" ? "sage" : undefined}
        footer={
          open === "sheet" ? (
            <button type="button" onClick={() => setOpen(null)} className="tap-target mb-1 w-full rounded-pill bg-ink font-display text-ink-inverse">
              Done
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4 px-5 pb-6 text-ink-soft">
          {Array.from({ length: open === "world" ? 12 : 3 }, (_, i) => (
            <p key={i}>
              Paragraph {i + 1}. Content scrolls inside the sheet; the page behind stays still. Tab stays inside, and focus goes back to the
              button that opened it.
            </p>
          ))}
          <input aria-label="Example field" placeholder="Focusable field" className="tap-target w-full rounded-soft border border-paper-edge bg-paper-raised px-3" />
        </div>
      </Sheet>
    </div>
  );
}

/** Vinyl + VoiceObject, playing and paused. */
export function MediaLab() {
  const [vinyl, setVinyl] = useState(false);
  const [voice, setVoice] = useState(false);
  const level = useMotionValue(0);
  const playingRef = useRef(voice);
  useEffect(() => {
    playingRef.current = voice;
  }, [voice]);
  // A fake voice envelope for the demo (syllables ≈ 4–6 Hz with slower phrasing).
  useAnimationFrame((t) => {
    if (!playingRef.current) {
      if (level.get() !== 0) level.set(0);
      return;
    }
    const syll = Math.max(0, Math.sin(t / 95) * Math.sin(t / 37));
    const phrase = 0.5 + 0.5 * Math.sin(t / 900);
    level.set(Math.min(1, syll * phrase * 1.3));
  });

  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
      <figure className="space-y-3">
        <Vinyl playing={vinyl} artworkUrl={song.appleMusic.artwork.replace("100x100bb", "600x600bb")} title={song.appleMusic.title} artist={song.appleMusic.artist} size={260} />
        <figcaption className="flex items-center gap-3">
          <Pill id="vinyl-toggle" pressed={vinyl} onClick={() => setVinyl((p) => !p)}>
            {vinyl ? "Pause" : "Play"}
          </Pill>
          <span className="postal-label text-ink-faded">Artwork label</span>
        </figcaption>
      </figure>
      <figure className="space-y-3">
        <Vinyl playing={vinyl} title="Here Comes The Sun - Remastered 2009" artist="The Beatles" size={260} />
        <figcaption className="postal-label text-ink-faded">Printed paper label (fallback)</figcaption>
      </figure>
      <figure className="space-y-3">
        <VoiceObject playing={voice} level={level} size={210} />
        <figcaption className="flex items-center gap-3">
          <Pill id="voice-toggle" pressed={voice} onClick={() => setVoice((p) => !p)}>
            {voice ? "Pause" : "Play"}
          </Pill>
          <span className="postal-label text-ink-faded">With a live level</span>
        </figcaption>
      </figure>
    </div>
  );
}
