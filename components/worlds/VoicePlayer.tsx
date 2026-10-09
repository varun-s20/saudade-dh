"use client";

/**
 * A clean, simple, accessible voice player (the custom animated skin is deferred, CLIENT_GUIDE §10):
 * one large play/pause button, the recording's waveform (from `voice.peaks`) with progress,
 * a scrubber (a real range input with "0:23 of 1:08" as its value text) and elapsed / total.
 * No browser <audio controls>: the element is created in code and never rendered.
 *
 * The UI follows REAL playback (the `playing` event), never the click (RESEARCH §4.4).
 *
 * Loudness for the radio (`level`, 0..1, a MotionValue so nothing re-renders per frame):
 * an AnalyserNode on the audio element, created and resumed inside the play gesture. It is
 * skipped (and the level is read from the waveform peaks instead) when routing the element
 * through Web Audio could silence it:
 *   - cross-origin media (needs CORS on the CDN, or the output is muted),
 *   - iPhone/iPad without the Audio Session API (iOS < 16.4: Web Audio obeys the silent switch).
 */
import type { MotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VoiceContent } from "@/lib/services/types";
import { clock, spokenDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import "./worlds.css";

export type VoiceStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface VoicePlayerProps {
  voice: VoiceContent;
  /** Resolved media URL (undefined while resolving, null if missing). */
  src: string | null | undefined;
  fromName?: string | null;
  /** Written with the current loudness while playing; 0 otherwise. */
  level: MotionValue<number>;
  onStatusChange?: (status: VoiceStatus) => void;
}

interface Graph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
type LegacyAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function isAppleTouch(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function sameOrigin(url: string): boolean {
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Sources to try, in order. Demo asset only: /public/demo/voice ships an MP3 twin of the AAC clip
 * (docs/ASSETS.md) for browsers built without AAC (open-source Chromium). Production voice notes
 * are always AAC/m4a (ARCHITECTURE §5), which plays on every target.
 */
function sourcesFor(src: string, mediaId: string, mime: string): { url: string; type: string }[] {
  const list = [{ url: src, type: mime }];
  if (mediaId.startsWith("demo:") && /\.m4a$/i.test(src)) list.push({ url: src.replace(/\.m4a$/i, ".mp3"), type: "audio/mpeg" });
  return list;
}

/** Waveform loudness at a fraction of the recording (the fallback level). */
function peakAt(peaks: readonly number[], f: number): number {
  if (peaks.length === 0) return 0.5;
  const pos = Math.min(peaks.length - 1, Math.max(0, f * (peaks.length - 1)));
  const i = Math.floor(pos);
  const a = peaks[i] ?? 0;
  const b = peaks[Math.min(peaks.length - 1, i + 1)] ?? a;
  return Math.min(1, (a + (b - a) * (pos - i)) * 1.15);
}

export function VoicePlayer({ voice, src, fromName, level, onStatusChange }: VoicePlayerProps) {
  const duration = Math.max(1, voice.durationSec);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [time, setTime] = useState(0);
  /** Where the radio's loudness comes from (exposed as a data attribute for QA). */
  const [levelSource, setLevelSource] = useState<"analyser" | "waveform" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const graphTried = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const onStatusRef = useRef(onStatusChange);
  useLayoutEffect(() => {
    onStatusRef.current = onStatusChange;
  });

  const report = useCallback((s: VoiceStatus) => {
    setStatus(s);
    onStatusRef.current?.(s);
  }, []);

  // The audio element lives for as long as the world is open. Cleanup (close, or Activity hiding
  // the route) pauses it and releases the audio graph; a re-open builds a fresh one.
  const { mediaId, mime } = voice;
  useEffect(() => {
    if (!src) return;
    const audio = new Audio();
    audio.preload = "metadata";
    const sources = sourcesFor(src, mediaId, mime);
    let current = Math.max(
      0,
      sources.findIndex((s) => audio.canPlayType(s.type) !== ""),
    );
    let wantsPlay = false;
    audio.src = sources[current].url;

    const offs: (() => void)[] = [];
    const on = (type: string, fn: () => void) => {
      audio.addEventListener(type, fn);
      offs.push(() => audio.removeEventListener(type, fn));
    };
    on("play", () => {
      wantsPlay = true;
    });
    on("playing", () => report("playing"));
    on("waiting", () => report("loading"));
    on("pause", () => {
      wantsPlay = false;
      if (!audio.ended) report("paused");
    });
    on("ended", () => {
      wantsPlay = false;
      setTime(duration);
      report("ended");
    });
    on("timeupdate", () => setTime(audio.currentTime));
    on("loadedmetadata", () => {
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
    });
    on("error", () => {
      if (current + 1 < sources.length) {
        current += 1;
        const resume = wantsPlay;
        audio.src = sources[current].url;
        audio.load();
        if (resume) audio.play().catch(() => report("paused"));
        return;
      }
      report("error");
    });
    audioRef.current = audio;

    return () => {
      offs.forEach((off) => off());
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      const g = graphRef.current;
      if (g) void g.ctx.close().catch(() => undefined);
      graphRef.current = null;
      graphTried.current = false;
      audioRef.current = null;
      level.set(0);
    };
  }, [src, mediaId, mime, duration, level, report]);

  // While playing: progress and loudness every frame (state only when it visibly changes).
  useEffect(() => {
    if (status !== "playing") {
      level.set(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const t = audio.currentTime;
      setTime((prev) => (Math.abs(prev - t) > 0.1 ? t : prev));
      const g = graphRef.current;
      if (g) {
        g.analyser.getByteTimeDomainData(g.data);
        let sum = 0;
        for (let i = 0; i < g.data.length; i++) {
          const v = (g.data[i] - 128) / 128;
          sum += v * v;
        }
        level.set(Math.min(1, Math.sqrt(sum / g.data.length) * 4.5));
      } else {
        level.set(peakAt(voice.peaks, t / duration));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, level, voice.peaks, duration]);

  /** Inside the play gesture: build (once) and resume the analyser graph. */
  const ensureGraph = (audio: HTMLAudioElement) => {
    if (graphRef.current) {
      void graphRef.current.ctx.resume();
      return;
    }
    if (graphTried.current) return;
    graphTried.current = true;
    setLevelSource("waveform");
    const nav = navigator as AudioSessionNavigator;
    if (!sameOrigin(audio.currentSrc || audio.src)) return;
    if (isAppleTouch() && !nav.audioSession) return;
    const Ctx = window.AudioContext ?? (window as LegacyAudioWindow).webkitAudioContext;
    if (!Ctx) return;
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      void ctx.resume();
      graphRef.current = { ctx, analyser, data: new Uint8Array(analyser.fftSize) };
      setLevelSource("analyser");
    } catch {
      graphRef.current = null;
    }
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    ensureGraph(audio);
    if (audio.ended || audio.currentTime >= duration - 0.05) audio.currentTime = 0;
    report("loading");
    const p = audio.play();
    p?.catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      report(audio.error ? "error" : "paused");
    });
  };

  const seek = (t: number) => {
    const next = Math.max(0, Math.min(duration, t));
    setTime(next);
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "ended") report("paused");
    if (audio.readyState >= 1) audio.currentTime = next;
    else pendingSeek.current = next;
  };

  const playing = status === "playing";
  const from = fromName ? ` from ${fromName}` : "";
  const playLabel = `Play voice message${from}, ${spokenDuration(duration)}`;
  const shown = Math.min(time, duration);
  const progress = shown / duration;
  const ready = Boolean(src) && status !== "error";

  return (
    <div className="wd-player w-full" data-voice-status={status} data-voice-level={levelSource ?? undefined}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? `Pause voice message${from}` : playLabel}
          className={cn("wd-play shrink-0", status === "loading" && "wd-play--loading")}
          data-voice-play
        >
          {playing ? (
            <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6.2" y="5" width="4.2" height="14" rx="1.3" />
              <rect x="13.6" y="5" width="4.2" height="14" rx="1.3" />
            </svg>
          ) : (
            <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.2 5.3c0-.8.9-1.3 1.6-.9l9.3 6c.6.4.6 1.3 0 1.7l-9.3 6c-.7.4-1.6-.1-1.6-.9z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="relative h-12">
            <Waveform peaks={voice.peaks} progress={progress} />
            <input
              type="range"
              min={0}
              max={duration}
              step={1}
              value={shown}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!ready}
              aria-label={`Position in the voice message${from}`}
              aria-valuetext={`${clock(shown)} of ${clock(duration)}`}
              className="wd-scrub absolute inset-0 h-full w-full"
              data-voice-scrub
            />
          </div>
          <div className="mt-1 flex justify-between font-postal text-xs tracking-wider text-sage-ink tabular-nums" aria-hidden>
            <span>{clock(shown)}</span>
            <span>{clock(duration)}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 min-h-5 text-center text-sm text-ink-faded" role="status" aria-live="polite">
        {status === "loading" ? "Tuning in…" : status === "error" ? "This recording won't play in this browser. Try opening the link in Safari or Chrome." : src === null ? "This recording isn't available right now." : ""}
      </p>
    </div>
  );
}

/** The recording's shape, drawn from its peaks; bars already heard are inked darker. */
function Waveform({ peaks, progress }: { peaks: readonly number[]; progress: number }) {
  const bars = peaks.length > 0 ? peaks : Array.from({ length: 48 }, () => 0.3);
  const n = bars.length;
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n * 4} 40`} preserveAspectRatio="none">
      {bars.map((p, i) => {
        const h = Math.max(3, Math.min(1, p) * 36);
        return (
          <rect
            key={i}
            x={i * 4 + 0.7}
            y={(40 - h) / 2}
            width={2.6}
            height={h}
            rx={1.3}
            className={(i + 0.5) / n <= progress ? "wd-wave__bar wd-wave__bar--heard" : "wd-wave__bar"}
          />
        );
      })}
    </svg>
  );
}
