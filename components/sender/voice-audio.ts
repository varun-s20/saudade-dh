/**
 * Audio helpers for the voice editor (S10). Browser-only; call from effects / handlers.
 */
import { site } from "@/config/site";

export const VOICE_LIMIT_SEC = site.limits.voiceSeconds;
export const VOICE_UPLOAD_MAX_BYTES = site.limits.voiceUploadMaxMB * 1024 * 1024;
export const PEAK_COUNT = 96;
/** Level samples per second while recording (feeds both the live waveform and the stored peaks). */
export const LEVEL_RATE = 20;

const AUDIO_EXT = /\.(m4a|mp4|aac|mp3|wav|wave|ogg|oga|opus|webm|caf|aiff?|amr|3gp|flac)$/i;

export function looksLikeAudio(file: File): boolean {
  return file.type.startsWith("audio/") || (file.type === "video/mp4" && /\.m4a$/i.test(file.name)) || AUDIO_EXT.test(file.name);
}

/** Best guess at a mime type when the OS didn't give one (common for .m4a on Windows/Android). */
export function mimeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    wave: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
    webm: "audio/webm",
    caf: "audio/x-caf",
    flac: "audio/flac",
  };
  return map[ext] ?? "application/octet-stream";
}

type AudioCtor = typeof AudioContext;
export function audioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null;
}

/**
 * Duration of an audio URL from its metadata (an <audio> element, as the browser will play it).
 * MediaRecorder WebM files report Infinity until the end is seen, so seek far to force it.
 */
export function readDuration(url: string, timeoutMs = 8000): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      a.onloadedmetadata = null;
      a.ontimeupdate = null;
      a.onerror = null;
      a.removeAttribute("src");
      a.load();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("timeout"))), timeoutMs);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        const d = a.duration;
        finish(() => resolve(d));
        return;
      }
      a.ontimeupdate = () => {
        const d = a.duration;
        finish(() => (Number.isFinite(d) && d > 0 ? resolve(d) : reject(new Error("duration"))));
      };
      a.currentTime = 1e7;
    };
    a.onerror = () => finish(() => reject(new Error("decode")));
    a.src = url;
  });
}

/** Resample any series to `n` buckets (mean), normalise to 0..1 with a soft floor. */
export function toPeaks(values: number[], n = PEAK_COUNT): number[] {
  if (!values.length) return Array.from({ length: n }, () => 0.12);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * values.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / n));
    let sum = 0;
    for (let j = a; j < b && j < values.length; j++) sum += values[j];
    out.push(sum / Math.max(1, Math.min(b, values.length) - a));
  }
  const max = Math.max(...out, 1e-6);
  // sqrt lifts quiet speech so the shape reads; a small floor keeps silence visible as a line.
  return out.map((v) => Math.round(Math.max(0.04, Math.sqrt(v / max)) * 1000) / 1000);
}

/** 96 normalised peaks from an audio file (decodeAudioData). Rejects if the browser can't decode it. */
export async function peaksFromBlob(blob: Blob, n = PEAK_COUNT): Promise<number[]> {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error("no audio context");
  const ctx = new Ctor();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / (n * 8)));
    const series: number[] = [];
    for (let i = 0; i < data.length; i += size) {
      let peak = 0;
      const end = Math.min(data.length, i + size);
      for (let j = i; j < end; j++) peak = Math.max(peak, Math.abs(data[j]));
      series.push(peak);
    }
    return toPeaks(series, n);
  } finally {
    void ctx.close();
  }
}

/** Root-mean-square loudness of the analyser's current frame, 0..~1. */
export function rmsLevel(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
