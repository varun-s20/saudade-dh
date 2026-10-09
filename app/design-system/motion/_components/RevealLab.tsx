"use client";

import { useState } from "react";
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { STAMPS } from "@/config/stamps";
import { useDemo, type MotionOverride } from "@/lib/state/demo";
import { FirstTapReveal, type RevealResult } from "@/components/reveal/FirstTapReveal";

/**
 * The reveal under test. On phones it fills the viewport (what the recipient sees); from `lg` up
 * it sits in a 390×780 phone frame beside its controls.
 */
export function RevealLab({
  initialKinds,
  initialName,
  initialFrom,
  initialRate,
  framed = true,
}: {
  initialKinds: StampKind[];
  initialName: string;
  initialFrom: string;
  initialRate: number;
  framed?: boolean;
}) {
  const [kinds, setKinds] = useState<StampKind[]>(initialKinds);
  const [rate, setRate] = useState(initialRate);
  const [name, setName] = useState(initialName);
  const [run, setRun] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const motion = useDemo((s) => s.motion);
  const setMotion = useDemo((s) => s.setMotion);

  const toggle = (k: StampKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const replay = () => setRun((n) => n + 1);
  const onComplete = (r: RevealResult) =>
    setLog((l) => [`#${run + 1} onComplete · skipped: ${r.skipped} · reducedMotion: ${r.reducedMotion}`, ...l].slice(0, 6));

  return (
    <section aria-labelledby="reveal-lab" className={framed ? "lg:flex lg:min-h-svh lg:items-center lg:justify-center lg:gap-12 lg:p-10" : undefined}>
      <div className={framed ? "lg:h-[780px] lg:w-[390px] lg:shrink-0 lg:overflow-hidden lg:rounded-[2.5rem] lg:shadow-envelope lg:ring-8 lg:ring-ink/85" : undefined}>
        <div className={framed ? "h-svh min-h-screen lg:h-full lg:min-h-0" : undefined}>
          <FirstTapReveal
            key={`${run}-${kinds.join(",")}-${name}-${rate}`}
            contained={framed}
            playbackRate={rate}
            kinds={kinds}
            toName={name || null}
            fromName={initialFrom}
            postmarkDate="2026-10-08"
            mode="preview"
            onComplete={onComplete}
            onOpenStamp={(k) => setLog((l) => [`onOpenStamp · ${k}`, ...l].slice(0, 6))}
          />
        </div>
      </div>

      <div className={framed ? "phone-column space-y-5 py-8 lg:m-0 lg:max-w-sm lg:p-0" : "phone-column space-y-5 py-8"}>
        <div>
          <p className="postal-label text-postmark">Motion playground</p>
          <h1 id="reveal-lab" className="font-display text-3xl text-ink">
            First-tap reveal
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Only stamps with content are placed. Skip appears after the tap.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="postal-label text-ink-faded">Stamps with content</legend>
          <div className="flex flex-wrap gap-2">
            {STAMP_KINDS.map((k) => (
              <label key={k} className="tap-target inline-flex items-center gap-2 rounded-pill border border-paper-edge bg-paper-raised px-3 text-sm">
                <input id={`kind-${k}`} type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} className="accent-[var(--postmark)]" />
                {STAMPS[k].label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1 text-sm">
          <span className="postal-label text-ink-faded">Addressee</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tap-target block w-full rounded-soft border border-paper-edge bg-paper-raised px-3"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="postal-label text-ink-faded">Motion (Demo Panel override, app-wide)</legend>
          <div className="flex gap-2">
            {(["system", "reduce", "full"] as MotionOverride[]).map((m) => (
              <button
                key={m}
                type="button"
                id={`motion-${m}`}
                aria-pressed={motion === m}
                onClick={() => {
                  setMotion(m);
                  replay();
                }}
                className="tap-target rounded-pill border border-paper-edge px-4 text-sm aria-pressed:bg-ink aria-pressed:text-ink-inverse"
              >
                {m === "system" ? "System" : m === "reduce" ? "Reduced" : "Full"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="postal-label text-ink-faded">Playback (design review; sound off when slowed)</legend>
          <div className="flex gap-2">
            {[1, 0.5, 0.25].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rate === r}
                onClick={() => setRate(r)}
                className="tap-target rounded-pill border border-paper-edge px-4 text-sm aria-pressed:bg-ink aria-pressed:text-ink-inverse"
              >
                {r === 1 ? "Real time" : `${1 / r}× slower`}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" id="replay" onClick={replay} className="tap-target rounded-pill bg-ink px-6 font-display text-ink-inverse">
          Replay reveal
        </button>

        <ol aria-live="polite" className="space-y-1 font-postal text-xs text-ink-soft">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
