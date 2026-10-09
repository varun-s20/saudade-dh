"use client";

/**
 * Reveal sound design: synthesised with Web Audio, no audio files.
 *
 *   crack   a soft wax-seal crack (two tiny transients + a low "tock")
 *   rustle  paper rustle as the flap opens (granular, band-passed noise)
 *   slide   the letter sliding out of the envelope (a soft noise sweep)
 *   unfold  a short crisp rustle per fold
 *   thud    a stamp landing on paper (muted low sine + paper contact)
 *   ink     a postmark pressed down (a dull rubber "tock")
 *
 * Rules (RESEARCH §4.4, MOTION_SPEC §9):
 * - The AudioContext is created/resumed ONLY inside the recipient's gesture (`unlock()` must be
 *   called synchronously from the click/keydown handler). Nothing ever plays before that.
 * - Sounds carry no meaning; everything works muted (and iOS's silent switch may mute Web Audio).
 * - Cues are scheduled on the audio clock (`at` seconds from now) so they stay in sync with the
 *   timeline; `stopAll()` silences anything still scheduled (Skip).
 */

export type SoundCue = "crack" | "rustle" | "slide" | "unfold" | "thud" | "ink";

export interface RevealSound {
  /** Create/resume the AudioContext. Call synchronously inside a user gesture. */
  unlock(): void;
  /** Schedule a cue `at` seconds from now. No-op until unlocked, or while muted. */
  play(cue: SoundCue, opts?: { at?: number; gain?: number }): void;
  setMuted(muted: boolean): void;
  /** Silence everything scheduled so far (used by Skip and unmount). */
  stopAll(): void;
  dispose(): void;
}

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Master level. Everything here is meant to sit just above silence. */
const MASTER = 0.75;

export function createRevealSound(initialMuted = false): RevealSound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  /** Per-session bus: replaced on stopAll() so already-scheduled sources go nowhere. */
  let bus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = initialMuted;

  const freshBus = () => {
    if (!ctx || !master) return;
    if (bus) {
      try {
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setValueAtTime(0, ctx.currentTime);
        bus.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(master);
  };

  const unlock = () => {
    const Ctor = getAudioCtor();
    if (!Ctor) return;
    try {
      if (!ctx) {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER;
        master.connect(ctx.destination);
        freshBus();
        // 1.5 s of white noise, shared by every cue (random offsets keep it from repeating).
        const len = Math.floor(ctx.sampleRate * 1.5);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === "suspended") void ctx.resume();
      // iOS: play one silent sample inside the gesture so later scheduled sounds are allowed.
      const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      ctx = null; // Audio is decorative; never let it break the reveal.
    }
  };

  /** One grain of filtered noise. */
  const grain = (
    t: number,
    dur: number,
    peak: number,
    filter: { type: BiquadFilterType; freq: number; q?: number },
    attack = 0.002,
  ) => {
    if (!ctx || !bus || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    f.Q.value = filter.q ?? 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    const offset = Math.random() * (noise.duration - dur - 0.05);
    src.start(t, Math.max(0, offset), dur + 0.05);
  };

  /** A short pitched body (sine with a falling pitch): thuds, tocks. */
  const body = (t: number, from: number, to: number, dur: number, peak: number) => {
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  /** Granular paper rustle: crinkles whose density swells and fades over `dur`. */
  const rustle = (t: number, dur: number, level: number, bright = 1) => {
    const grains = Math.round(14 + dur * 26);
    for (let i = 0; i < grains; i++) {
      const p = Math.random();
      const env = Math.sin(Math.PI * p); // swell in the middle
      const gt = t + p * dur;
      grain(
        gt,
        0.012 + Math.random() * 0.045,
        level * (0.25 + env * 0.75) * (0.4 + Math.random() * 0.6),
        { type: "bandpass", freq: (1800 + Math.random() * 3400) * bright, q: 0.7 + Math.random() * 1.2 },
      );
    }
  };

  const play: RevealSound["play"] = (cue, opts) => {
    if (!ctx || !bus || muted) return;
    const t = ctx.currentTime + Math.max(0, opts?.at ?? 0) + 0.01;
    const k = opts?.gain ?? 1;
    switch (cue) {
      case "crack":
        grain(t, 0.018, 0.11 * k, { type: "highpass", freq: 2200 });
        grain(t + 0.028, 0.012, 0.07 * k, { type: "highpass", freq: 3200 });
        grain(t + 0.006, 0.05, 0.05 * k, { type: "bandpass", freq: 900, q: 1.4 });
        body(t, 190, 95, 0.09, 0.05 * k);
        break;
      case "rustle":
        rustle(t, 0.55, 0.05 * k);
        break;
      case "slide": {
        if (!noise) break;
        // A soft continuous sweep under a few crinkles: paper sliding against paper.
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.Q.value = 0.6;
        f.frequency.setValueAtTime(1100, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 0.55);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.022 * k, t + 0.14);
        g.gain.setValueAtTime(0.022 * k, t + 0.38);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
        src.connect(f).connect(g).connect(bus);
        src.start(t, Math.random() * 0.6, 0.7);
        rustle(t + 0.05, 0.45, 0.022 * k, 0.8);
        break;
      }
      case "unfold":
        rustle(t, 0.22, 0.045 * k, 1.1);
        break;
      case "thud":
        body(t, 105, 52, 0.15, 0.13 * k);
        grain(t, 0.035, 0.045 * k, { type: "lowpass", freq: 650 });
        break;
      case "ink":
        body(t, 210, 130, 0.07, 0.05 * k);
        grain(t, 0.04, 0.06 * k, { type: "bandpass", freq: 760, q: 1.8 });
        break;
    }
  };

  const setMuted = (m: boolean) => {
    muted = m;
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(m ? 0 : MASTER, now, 0.03);
    }
  };

  const stopAll = () => freshBus();

  const dispose = () => {
    stopAll();
    if (ctx) void ctx.close().catch(() => undefined);
    ctx = null;
    master = null;
    bus = null;
    noise = null;
  };

  return { unlock, play, setMuted, stopAll, dispose };
}
