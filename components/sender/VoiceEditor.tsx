"use client";

/**
 * S10 · Voice editor. Record in the browser (MediaRecorder, the best mime from pickRecorderMime,
 * stored as the recorder's ACTUAL mimeType), with a live waveform (AnalyserNode) and a 3:00
 * countdown that stops by itself; or upload a voice memo (duration checked from its metadata).
 * Play it back, record again, then Save: the take is uploaded (services.media.upload) and
 * VoiceContent saved with 96 normalised peaks.
 *
 * States: idle · requesting mic · recording · recorded/playing · uploading · mic denied (real
 * NotAllowedError or the Demo Panel's "Mic denied") · no microphone · in-app browser (Instagram &
 * co. block the mic: open in Safari/Chrome, or upload) · MediaRecorder unsupported (upload only) ·
 * file too long / unreadable. The mic is released when recording stops and whenever the screen
 * is left or hidden.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { UploadTile } from "@/components/forms/UploadTile";
import { InkButton } from "@/components/ui/InkButton";
import { ProgressStamp } from "@/components/ui/ProgressStamp";
import { IconCheck, IconCopy, IconMic, IconStop, IconUpload, IconWarning } from "@/components/ui/icons";
import { STAMPS } from "@/config/stamps";
import { site } from "@/config/site";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import { services } from "@/lib/services";
import type { SenderEnvelope, VoiceContent } from "@/lib/services/types";
import { isForced } from "@/lib/state/demo";
import { toast } from "@/lib/state/toast";
import { canRecordAudio, detectInAppBrowser, IN_APP_NAMES, isAndroid, isIOS, pickRecorderMime, type InAppBrowser } from "@/lib/utils/env";
import { clock, spokenDuration } from "@/lib/utils/format";
import { SAVED_TOAST, saveErrorText } from "./copy";
import { LiveWaveform } from "./LiveWaveform";
import { RemoveStamp } from "./RemoveStamp";
import { SaveDock, type SaveTone } from "./SaveDock";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell, UnsavedGuard } from "./SenderShell";
import { useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";
import { VoicePlayer } from "./VoicePlayer";
import { audioContextCtor, looksLikeAudio, mimeFor, peaksFromBlob, readDuration, toPeaks, VOICE_LIMIT_SEC, VOICE_UPLOAD_MAX_BYTES } from "./voice-audio";

const TITLE = STAMPS.voice.sender.editorTitle;
/** Warn (red clock + announcement) in the last 30 seconds. */
const LOW_SEC = 30;
/** Ignore accidental taps: anything shorter isn't kept. */
const MIN_SEC = 1;

type Mic = "idle" | "requesting" | "recording" | "denied" | "no_device" | "error" | "unsupported";
type Platform = "ios" | "android" | "other";

interface Take {
  /** Local audio (new recording or picked file). Absent for the saved take. */
  blob?: Blob;
  url: string | null;
  /** We created `url` with createObjectURL and must revoke it. */
  ownsUrl: boolean;
  durationSec: number;
  mime: string;
  peaks: number[];
  source: "recorded" | "uploaded";
  /** Set once uploaded (the saved take, or a take uploaded by a save that then failed). */
  mediaId?: string;
  fileName?: string;
}

const fromSaved = (v: VoiceContent): Take => ({
  url: null,
  ownsUrl: false,
  durationSec: v.durationSec,
  mime: v.mime,
  peaks: v.peaks,
  source: v.source,
  mediaId: v.mediaId,
});

const noop = () => () => {};
const useOrigin = () => useSyncExternalStore(noop, () => window.location.href, () => "");

interface ClientInfo {
  inApp: InAppBrowser;
  canRecord: boolean;
  platform: Platform;
}
let clientInfo: ClientInfo | null = null;
/** Where are we running? Client-only (null on the server and during hydration), read once per page load. */
function useClientInfo(): ClientInfo | null {
  return useSyncExternalStore(
    noop,
    () =>
      (clientInfo ??= {
        inApp: detectInAppBrowser(),
        canRecord: canRecordAudio(),
        platform: isIOS() ? "ios" : isAndroid() ? "android" : "other",
      }),
    () => null,
  );
}

export function VoiceEditor() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  if (q.status !== "success") {
    return (
      <SenderShell token={token} title={TITLE} kind="voice">
        <EnvelopeGate query={q} reload={() => q.reload()}>
          {() => null}
        </EnvelopeGate>
      </SenderShell>
    );
  }
  return <VoiceBody token={token} env={q.data} refresh={() => q.reload(true)} />;
}

function VoiceBody({ token, env, refresh }: { token: string; env: SenderEnvelope; refresh: () => void }) {
  const record = env.contents.voice;
  const reduced = useReducedMotionPref();

  const [saved, setSaved] = useState<Take | null>(() => (record ? fromSaved(record.content) : null));
  const [take, setTake] = useState<Take | null>(saved);
  const [syncedVersion, setSyncedVersion] = useState(record?.version ?? 0);
  const [mic, setMic] = useState<Mic>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [announce, setAnnounce] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const where = useClientInfo();
  const [tryAnyway, setTryAnyway] = useState(false);

  // Recording plumbing (refs: no re-render per frame).
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const levels = useRef<number[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const abandon = useRef(false);
  const lowAnnounced = useRef(false);
  const recordButton = useRef<HTMLButtonElement>(null);

  const dirty = take !== saved;

  // Saved elsewhere while nothing is pending here: take the newer envelope.
  const remoteVersion = record?.version ?? 0;
  if (remoteVersion !== syncedVersion && !dirty && !saving && mic !== "recording") {
    const next = record ? fromSaved(record.content) : null;
    setSyncedVersion(remoteVersion);
    setSaved(next);
    setTake(next);
  }


  // The saved take's playable URL.
  useEffect(() => {
    if (!saved || saved.url || !saved.mediaId) return;
    let live = true;
    const id = saved.mediaId;
    void services.media.getUrl(id).then((url) => {
      if (!live || !url) return;
      const withUrl = { ...saved, url };
      setSaved(withUrl);
      setTake((t) => (t === saved ? withUrl : t));
    });
    return () => {
      live = false;
    };
  }, [saved]);

  // ── Mic lifecycle ──────────────────────────────────────────────────────
  const release = () => {
    clearInterval(ticker.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setAnalyser(null);
  };

  // Leaving or hiding the screen (Activity) mid-recording: stop, keep nothing, free the mic.
  useLayoutEffect(
    () => () => {
      if (recorder.current?.state === "recording") {
        abandon.current = true;
        recorder.current.stop();
      }
      recorder.current = null;
      clearInterval(ticker.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      void audioCtx.current?.close().catch(() => undefined);
      audioCtx.current = null;
      setAnalyser(null);
      setMic((m) => (m === "recording" || m === "requesting" ? "idle" : m));
    },
    [],
  );

  useEffect(() => {
    const onHide = () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  });

  const replaceTake = (next: Take) => {
    setTake((prev) => {
      if (prev && prev !== saved && prev.ownsUrl && prev.url) URL.revokeObjectURL(prev.url);
      if (prev && prev !== saved && prev.mediaId) void services.media.remove(token, prev.mediaId);
      return next;
    });
    setSaveError(null);
  };

  const finish = (rec: MediaRecorder, fallbackMime: string | undefined) => {
    const dur = Math.min(VOICE_LIMIT_SEC, (performance.now() - startedAt.current) / 1000);
    const type = rec.mimeType || fallbackMime || chunks.current[0]?.type || "audio/webm";
    const blob = new Blob(chunks.current, { type });
    const peaks = toPeaks(levels.current);
    chunks.current = [];
    release();
    recorder.current = null;
    if (abandon.current) {
      abandon.current = false;
      return;
    }
    setMic("idle");
    if (dur < MIN_SEC || blob.size === 0) {
      setAnnounce("That was very short, so we didn't keep it. Try again and speak for a little longer.");
      return;
    }
    replaceTake({ blob, url: URL.createObjectURL(blob), ownsUrl: true, durationSec: Math.round(dur * 10) / 10, mime: type, peaks, source: "recorded" });
    setAnnounce(`Recorded ${spokenDuration(dur)}. Play it back, or save it.`);
    requestAnimationFrame(() => recordButton.current?.focus());
  };

  const stop = () => {
    const rec = recorder.current;
    if (rec && rec.state === "recording") rec.stop();
  };

  const start = async () => {
    setFileError(null);
    setAnnounce("");
    if (isForced("mic_denied")) {
      setMic("denied");
      return;
    }
    if (!canRecordAudio()) {
      setMic("unsupported");
      return;
    }
    setMic("requesting");
    // Create the AudioContext inside the tap (iOS only lets it start from a gesture).
    const Ctor = audioContextCtor();
    const ctx = Ctor ? new Ctor() : null;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      void ctx?.close().catch(() => undefined);
      const name = err instanceof DOMException ? err.name : "";
      setMic(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no_device" : "error");
      return;
    }
    const mime = pickRecorderMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 96_000 } : undefined);
    } catch {
      try {
        rec = new MediaRecorder(media);
      } catch {
        media.getTracks().forEach((t) => t.stop());
        void ctx?.close().catch(() => undefined);
        setMic("unsupported");
        return;
      }
    }
    stream.current = media;
    audioCtx.current = ctx;
    if (ctx) {
      await ctx.resume().catch(() => undefined);
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.15;
      ctx.createMediaStreamSource(media).connect(node);
      setAnalyser(node);
    }
    chunks.current = [];
    levels.current = [];
    abandon.current = false;
    lowAnnounced.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => finish(rec, mime);
    recorder.current = rec;
    rec.start(250);
    startedAt.current = performance.now();
    setElapsed(0);
    setMic("recording");
    setAnnounce(`Recording. You have up to ${spokenDuration(VOICE_LIMIT_SEC)}.`);
    clearInterval(ticker.current);
    ticker.current = setInterval(() => {
      const s = (performance.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (!lowAnnounced.current && VOICE_LIMIT_SEC - s <= LOW_SEC) {
        lowAnnounced.current = true;
        setAnnounce(`${LOW_SEC} seconds left.`);
      }
      if (s >= VOICE_LIMIT_SEC) stop();
    }, 200);
  };

  // ── Upload a file instead ──────────────────────────────────────────────
  const onFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileError(null);
    if (!looksLikeAudio(file)) {
      setFileError("That isn't an audio file. Choose a voice memo, like an M4A, MP3 or WAV.");
      return;
    }
    if (file.size > VOICE_UPLOAD_MAX_BYTES) {
      setFileError(`That file is over ${site.limits.voiceUploadMaxMB} MB. Choose a shorter recording.`);
      return;
    }
    setReading(true);
    const url = URL.createObjectURL(file);
    let dur: number | null = null;
    try {
      dur = await readDuration(url);
    } catch {
      dur = null;
    }
    if (!dur) {
      URL.revokeObjectURL(url);
      setReading(false);
      setFileError("We couldn't play that file. Try an M4A, MP3 or WAV.");
      return;
    }
    if (dur > VOICE_LIMIT_SEC + 0.5) {
      URL.revokeObjectURL(url);
      setReading(false);
      setFileError(`That recording is ${clock(dur)}. A voice message can be up to ${clock(VOICE_LIMIT_SEC)}, so trim it in your voice memos app, then try again.`);
      return;
    }
    let peaks: number[];
    try {
      peaks = await peaksFromBlob(file);
    } catch {
      peaks = toPeaks([]);
    }
    setReading(false);
    replaceTake({ blob: file, url, ownsUrl: true, durationSec: Math.round(dur * 10) / 10, mime: mimeFor(file), peaks, source: "uploaded", fileName: file.name });
    setAnnounce(`Added ${file.name}, ${spokenDuration(dur)}. Play it back, or save it.`);
  };

  // ── Save / discard ─────────────────────────────────────────────────────
  const canSave = dirty && Boolean(take) && !saving && mic !== "recording" && mic !== "requesting" && !reading;

  const save = async () => {
    if (!canSave || !take) return;
    setSaving(true);
    setSaveError(null);
    let mediaId = take.mediaId;
    if (!mediaId) {
      if (!take.blob) return;
      setUploadProgress(0);
      const up = await services.media.upload(token, take.blob, { kind: "voice", mime: take.mime, bytes: take.blob.size, durationSec: take.durationSec }, (f) => setUploadProgress(f));
      setUploadProgress(null);
      if (!up.ok) {
        setSaving(false);
        const msg =
          up.error.code === "upload_failed" || up.error.code === "network"
            ? "Your voice message didn't upload. Check your connection, then try again. It's still here."
            : saveErrorText(up.error);
        setSaveError(msg);
        toast("Didn't upload", { tone: "error", body: msg });
        return;
      }
      mediaId = up.data.id;
      const uploaded = { ...take, mediaId };
      setTake(uploaded);
    }
    const content: VoiceContent = { kind: "voice", mediaId, durationSec: take.durationSec, mime: take.mime, peaks: take.peaks, source: take.source };
    const res = await services.content.save(token, content);
    setSaving(false);
    if (!res.ok) {
      const msg = saveErrorText(res.error);
      setSaveError(msg);
      toast("Your voice message didn't save", { tone: "error", body: msg });
      return;
    }
    if (saved?.mediaId && saved.mediaId !== mediaId) void services.media.remove(token, saved.mediaId);
    const next: Take = { ...take, mediaId };
    setSaved(next);
    setTake(next);
    setSyncedVersion(res.data.version);
    toast(SAVED_TOAST, { tone: "success", body: "Your voice is in the envelope." });
    refresh();
  };

  const discard = () => {
    if (take && take !== saved) {
      if (take.ownsUrl && take.url) URL.revokeObjectURL(take.url);
      if (take.mediaId && take.mediaId !== saved?.mediaId) void services.media.remove(token, take.mediaId);
    }
    setTake(saved);
    setFileError(null);
    setSaveError(null);
  };

  // ── Copy ───────────────────────────────────────────────────────────────
  let status: string;
  let tone: SaveTone = "neutral";
  if (uploadProgress !== null) {
    status = `Sending your voice… ${Math.round(uploadProgress * 100)}%`;
    tone = "busy";
  } else if (saving) {
    status = "Saving…";
    tone = "busy";
  } else if (mic === "recording") {
    status = "Recording…";
    tone = "busy";
  } else if (saveError) {
    status = "Didn't save. Try again.";
    tone = "error";
  } else if (dirty) {
    status = "Unsaved changes";
    tone = "dirty";
  } else if (record) {
    status = "Saved";
    tone = "saved";
  } else {
    status = "Nothing to save yet";
  }

  const recording = mic === "recording";
  const left = Math.max(0, VOICE_LIMIT_SEC - elapsed);
  const inApp = where?.inApp ?? null;
  const showInApp = Boolean(inApp) && !tryAnyway && !recording;
  const unsupported = mic === "unsupported" || (where !== null && !where.canRecord);
  const platform = where?.platform ?? "other";
  const browserName = platform === "ios" ? "Safari" : platform === "android" ? "Chrome" : "Safari or Chrome";

  return (
    <SenderShell token={token} title={TITLE} kind="voice" lede={<>Up to three minutes, in your own voice. Say it the way you would if they were in the room.</>} dock={<SaveDock status={status} tone={tone} canSave={canSave} saving={saving} onSave={save} />}>
      <UnsavedGuard dirty={dirty} onDiscard={discard} />

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {showInApp && inApp ? (
        <InAppCard app={IN_APP_NAMES[inApp]} browserName={browserName} onTryAnyway={() => setTryAnyway(true)} />
      ) : unsupported ? (
        <div className="ss-card ss-rise mt-6" data-tone="warn" role="status">
          <p className="font-display text-xl text-ink">Recording isn&apos;t available in this browser</p>
          <p className="mt-1 leading-relaxed text-ink-soft">You can still upload a voice memo below. Or open this page in {browserName} to record here.</p>
        </div>
      ) : (
        <>
          {mic === "denied" ? (
            <MicDeniedCard platform={platform} onRetry={start} />
          ) : mic === "no_device" || mic === "error" ? (
            <div className="ss-card ss-rise mt-6" data-tone="error" role="alert">
              <p className="font-display text-xl text-ink">{mic === "no_device" ? "We couldn't find a microphone" : "The microphone didn't start"}</p>
              <p className="mt-1 leading-relaxed text-ink-soft">
                {mic === "no_device" ? "Plug one in or try another device, or upload a voice memo below." : "Try again, or upload a voice memo below."}
              </p>
              <InkButton variant="secondary" className="mt-3" onClick={start}>
                Try again
              </InkButton>
            </div>
          ) : null}

          {/* The recorder */}
          <section aria-label="Recorder" className="mt-6 flex flex-col items-center text-center">
            {recording ? (
              <>
                <p className="ss-clock" data-low={left <= LOW_SEC} aria-hidden>
                  {clock(Math.ceil(left))}
                </p>
                <p className="postal-label mt-1 text-ink-faded">{left <= LOW_SEC ? "Nearly at the end" : `left of ${clock(VOICE_LIMIT_SEC)}`}</p>
                <LiveWaveform analyser={analyser} levelsRef={levels} reduced={reduced} className="ss-wave mt-4" />
              </>
            ) : null}
            {(!take || recording || mic === "requesting") && mic !== "denied" && mic !== "no_device" && mic !== "error" ? (
              <>
                <button
                  ref={recordButton}
                  type="button"
                  className="ss-rec mt-6"
                  data-state={recording ? "recording" : "idle"}
                  onClick={recording ? stop : start}
                  disabled={mic === "requesting" || reading || saving}
                  aria-label={recording ? `Stop recording, ${spokenDuration(elapsed)} so far` : "Start recording"}
                >
                  <span className="ss-rec__halo" aria-hidden />
                  <span className="ss-rec__face" aria-hidden>
                    {recording ? <IconStop size={38} /> : <IconMic size={44} />}
                  </span>
                </button>
                <p className="mt-4 text-ink-soft" aria-hidden={recording}>
                  {mic === "requesting"
                    ? "Allow the microphone when your browser asks."
                    : recording
                      ? "Tap to stop. It stops by itself at 3:00."
                      : `Tap to record · up to ${clock(VOICE_LIMIT_SEC)}`}
                </p>
              </>
            ) : null}
          </section>
        </>
      )}

      {/* The take: play it back before saving */}
      {take && !recording ? (
        <section aria-label="Your voice message" className="ss-card ss-rise mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="postal-label text-sage-ink">{take === saved ? "In your envelope" : take.source === "uploaded" ? "Uploaded" : "Just recorded"}</p>
            <p className="truncate text-sm text-ink-faded">{take.fileName ?? clock(take.durationSec)}</p>
          </div>
          {uploadProgress !== null ? (
            <div className="grid place-items-center py-2">
              <ProgressStamp value={uploadProgress} label="Sending your voice…" ink="sage" size={80} />
            </div>
          ) : take.url ? (
            <VoicePlayer key={take.url} src={take.url} durationSec={take.durationSec} peaks={take.peaks} label={take === saved ? "your voice message" : "your recording"} />
          ) : (
            <p className="text-ink-faded">Getting it ready…</p>
          )}
          {!showInApp && !unsupported ? (
            <div className="mt-4 border-t border-dashed border-paper-edge pt-3">
              <InkButton variant="secondary" onClick={start} disabled={saving || mic === "requesting"} icon={<IconMic size={18} />}>
                Record again
              </InkButton>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Upload alternative: always there (it works where the mic doesn't). */}
      {!recording ? (
        <div className="mt-6">
          <UploadTile
            accept="audio/*"
            onFiles={onFile}
            disabled={reading || saving}
            label={reading ? "Reading your file…" : take ? "Upload a different voice memo" : "Upload a voice memo instead"}
            hint={`M4A, MP3 or WAV · up to ${clock(VOICE_LIMIT_SEC)}`}
            icon={<IconUpload size={22} />}
            className="min-h-24"
          />
          <div aria-live="assertive">
            {fileError ? (
              <p className="ss-parse mt-3" data-tone="error">
                <IconWarning size={18} />
                <span>{fileError}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {record ? (
        <RemoveStamp
          token={token}
          kind="voice"
          status={env.unit.status}
          onRemoved={() => {
            if (record) void services.media.remove(token, record.content.mediaId);
            if (take?.ownsUrl && take.url) URL.revokeObjectURL(take.url);
            setSaved(null);
            setTake(null);
          }}
        />
      ) : null}
    </SenderShell>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function InAppCard({ app, browserName, onTryAnyway }: { app: string; browserName: string; onTryAnyway: () => void }) {
  const href = useOrigin();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      toast("Link copied", { tone: "success", body: `Paste it into ${browserName}.` });
    } catch {
      toast("Couldn't copy the link", { tone: "error", body: "Press and hold the address to copy it instead." });
    }
  };
  return (
    <div className="ss-card ss-rise mt-6" data-tone="warn" role="status">
      <p className="font-display text-xl leading-snug text-ink">
        {app}&apos;s built-in browser can&apos;t use your microphone.
      </p>
      <p className="mt-1 leading-relaxed text-ink-soft">
        Open this page in {browserName} to record, or upload a voice memo below. In {app}, tap <strong className="font-semibold text-ink">⋯</strong> then{" "}
        <strong className="font-semibold text-ink">Open in browser</strong>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InkButton variant="secondary" onClick={copy} icon={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}>
          {copied ? "Copied" : "Copy link"}
        </InkButton>
        <InkButton variant="quiet" onClick={onTryAnyway}>
          Try recording anyway
        </InkButton>
      </div>
    </div>
  );
}

function MicDeniedCard({ platform, onRetry }: { platform: Platform; onRetry: () => void }) {
  return (
    <div className="ss-card ss-rise mt-6" data-tone="error" role="alert">
      <p className="font-display text-xl leading-snug text-ink">Your microphone is turned off for this page</p>
      <p className="mt-1 leading-relaxed text-ink-soft">To record here, let the browser use it, then tap Try again. Or upload a voice memo below.</p>
      {platform === "ios" || platform === "other" ? (
        <>
          {platform === "other" ? <p className="mt-3 postal-label text-ink-faded">On iPhone</p> : null}
          <ol className="ss-steps">
            <li>
              Open <strong>Settings</strong> → <strong>Safari</strong> → <strong>Microphone</strong>, and choose <strong>Ask</strong> or <strong>Allow</strong>.
            </li>
            <li>
              Or tap <strong>aA</strong> in the address bar → <strong>Website Settings</strong> → <strong>Microphone</strong> → <strong>Allow</strong>.
            </li>
          </ol>
        </>
      ) : null}
      {platform === "android" || platform === "other" ? (
        <>
          {platform === "other" ? <p className="mt-3 postal-label text-ink-faded">On Android or a computer</p> : null}
          <ol className="ss-steps">
            <li>
              Tap the <strong>lock icon</strong> next to the address → <strong>Permissions</strong> → <strong>Microphone</strong> → <strong>Allow</strong>.
            </li>
          </ol>
        </>
      ) : null}
      <InkButton variant="secondary" className="mt-4" onClick={onRetry} icon={<IconMic size={18} />}>
        Try again
      </InkButton>
    </div>
  );
}
