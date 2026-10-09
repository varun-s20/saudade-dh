"use client";

/**
 * <VoicePlayer>: a plain, accessible player for checking a voice message before saving it:
 * play/pause, the waveform (from the stored peaks) inking in as it plays, time, and a scrubber.
 * Deliberately simple: the custom animated player skin is deferred (CLIENT_GUIDE §10).
 *
 * Uses the known duration (MediaRecorder WebM files report Infinity until fully played).
 * Pauses when the route is hidden (Activity keeps <audio> playing otherwise).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "@/components/ui/icons";
import { toast } from "@/lib/state/toast";
import { clock, spokenDuration } from "@/lib/utils/format";

export function VoicePlayer({ src, durationSec, peaks, label = "your recording" }: { src: string; durationSec: number; peaks: number[]; label?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const duration = Math.max(0.1, durationSec);

  useLayoutEffect(() => {
    const a = audio.current;
    return () => {
      a?.pause();
      setPlaying(false);
    };
  }, []);

  const toggle = async () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    try {
      if (a.ended || a.currentTime >= duration - 0.05) a.currentTime = 0;
      await a.play();
    } catch {
      setPlaying(false);
      toast("Couldn't play it here", { tone: "error", body: "This browser can't play that recording. It will still be saved for them." });
    }
  };

  const progress = Math.min(1, t / duration);

  return (
    <div className="ss-player">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setT(duration);
        }}
        onTimeUpdate={(e) => setT(Math.min(duration, e.currentTarget.currentTime))}
      />
      <button type="button" className="ss-player__btn" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`}>
        {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
      </button>
      <div className="ss-player__bars" aria-hidden>
        {peaks.map((p, i) => (
          <span key={i} className="ss-player__bar" style={{ height: `${Math.max(8, p * 100)}%` }} data-played={(i + 0.5) / peaks.length <= progress} />
        ))}
      </div>
      <input
        type="range"
        className="ss-range"
        min={0}
        max={duration}
        step={0.1}
        value={Math.min(t, duration)}
        aria-label={`Position in ${label}`}
        aria-valuetext={`${spokenDuration(t)} of ${spokenDuration(duration)}`}
        onChange={(e) => {
          const v = Number(e.target.value);
          setT(v);
          if (audio.current) audio.current.currentTime = v;
        }}
      />
      <p className="ss-player__time">
        <span>{clock(t)}</span>
        <span>{clock(duration)}</span>
      </p>
    </div>
  );
}
