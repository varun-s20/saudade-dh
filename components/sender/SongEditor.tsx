"use client";

/**
 * S11 · Song editor. Paste a Spotify or Apple Music link: instant local feedback while typing
 * (parseSongLink, no network), then the REAL resolver (services.content.resolveSong → the
 * server route follows short links and reads title/artist/artwork) on paste, after a short pause,
 * or on "Find song". The found song shows on its record (Vinyl, static: nothing is playing here).
 * Single tracks only (D-012). Explicit Save; no autosave.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StampedInput } from "@/components/forms/StampedInput";
import { Vinyl } from "@/components/media/Vinyl";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconCheck, IconExternal, IconRefresh, IconSearch, IconWarning } from "@/components/ui/icons";
import { STAMPS } from "@/config/stamps";
import { parseSongLink, type ParsedSong } from "@/lib/parsing/songs";
import { services } from "@/lib/services";
import type { SenderEnvelope, ServiceError, SongContent } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { displayTrackTitle } from "@/lib/utils/format";
import { SAVED_TOAST, saveErrorText } from "./copy";
import { RemoveStamp } from "./RemoveStamp";
import { SaveDock, type SaveTone } from "./SaveDock";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell, UnsavedGuard } from "./SenderShell";
import { useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";

const TITLE = STAMPS.song.sender.editorTitle;
const DEBOUNCE_MS = 650;
const PROVIDER_NAME = { spotify: "Spotify", apple: "Apple Music" } as const;
const SHARE_HOW = "Open the song in the app, tap Share, then Copy link.";

const sameSong = (a: SongContent | null, b: SongContent | null) => (a && b ? a.provider === b.provider && a.trackId === b.trackId : a === b);

type Feedback = { tone: "neutral" | "ok" | "warn" | "error"; text: string } | null;

/** What the link looks like, before any network call. */
function parseFeedback(parsed: ParsedSong, raw: string, focused: boolean): Feedback {
  switch (parsed.type) {
    case "empty":
      return null;
    case "track":
      return { tone: "neutral", text: `Looks like ${parsed.provider === "spotify" ? "a Spotify" : "an Apple Music"} song.` };
    case "short":
      return { tone: "neutral", text: `A ${PROVIDER_NAME[parsed.provider]} short link. We'll follow it to the song.` };
    case "not_a_track": {
      const what =
        parsed.what === "album"
          ? "a whole album"
          : parsed.what === "playlist"
            ? "a playlist"
            : parsed.what === "artist"
              ? "an artist's page"
              : parsed.what === "podcast"
                ? "a podcast"
                : `a ${PROVIDER_NAME[parsed.provider]} page, not a song`;
      return { tone: "warn", text: `That's ${what}. Share a single song instead: ${SHARE_HOW.charAt(0).toLowerCase()}${SHARE_HOW.slice(1)}` };
    }
    case "unsupported":
      // Don't nag mid-typing: only once it's long enough to be a link, or after leaving the field.
      return !focused || raw.trim().length >= 12 ? { tone: "error", text: "That isn't a Spotify or Apple Music link. Paste a song link from either app." } : null;
  }
}

function resolveErrorText(err: ServiceError): string {
  switch (err.code) {
    case "not_found":
      return "We couldn't find that song. Check the link, or copy it again from the app.";
    case "unsupported_link":
      return `That link doesn't lead to a single song. ${SHARE_HOW}`;
    case "network":
      return err.detail === "rate_limited"
        ? "That's a lot of links in a row. Wait a few seconds, then try again."
        : "We couldn't reach the music service just now. Check your connection, then try again.";
    default:
      return "Something went wrong finding that song. Try again in a moment.";
  }
}

export function SongEditor() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  if (q.status !== "success") {
    return (
      <SenderShell token={token} title={TITLE} kind="song">
        <EnvelopeGate query={q} reload={() => q.reload()}>
          {() => null}
        </EnvelopeGate>
      </SenderShell>
    );
  }
  return <SongBody token={token} env={q.data} refresh={() => q.reload(true)} />;
}

function SongBody({ token, env, refresh }: { token: string; env: SenderEnvelope; refresh: () => void }) {
  const record = env.contents.song;
  const saved = record?.content ?? null;

  const [baseline, setBaseline] = useState<SongContent | null>(saved);
  const [song, setSong] = useState<SongContent | null>(saved);
  const [link, setLink] = useState(saved?.url ?? "");
  const [syncedVersion, setSyncedVersion] = useState(record?.version ?? 0);
  const [focused, setFocused] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<ServiceError | null>(null);
  /** The link the current `song` / `resolveError` belongs to. */
  const [checkedLink, setCheckedLink] = useState(saved?.url ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pasted = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const dirty = !sameSong(song, baseline);

  const remoteVersion = record?.version ?? 0;
  if (remoteVersion !== syncedVersion && !dirty && !saving) {
    setSyncedVersion(remoteVersion);
    setBaseline(saved);
    setSong(saved);
    setLink(saved?.url ?? "");
    setCheckedLink(saved?.url ?? "");
  }

  const parsed = parseSongLink(link);
  const resolvable = parsed.type === "track" || parsed.type === "short";

  const resolve = async (raw: string) => {
    clearTimeout(timer.current);
    const value = raw.trim();
    if (!value) return;
    const id = ++requestId.current;
    setResolving(true);
    setResolveError(null);
    const res = await services.content.resolveSong(value);
    if (id !== requestId.current) return; // a newer link superseded this one
    setResolving(false);
    setCheckedLink(value);
    if (!res.ok) {
      setResolveError(res.error);
      return;
    }
    setSong(res.data);
    setSaveError(null);
  };

  const onChange = (value: string) => {
    const wasPaste = pasted.current;
    pasted.current = false;
    setLink(value);
    setResolveError(null);
    clearTimeout(timer.current);
    requestId.current += 1; // ignore any in-flight answer for the old text
    setResolving(false);
    const p = parseSongLink(value);
    if (p.type !== "track" && p.type !== "short") return;
    if (value.trim() === checkedLink && song) return;
    if (wasPaste) {
      void resolve(value);
    } else {
      timer.current = setTimeout(() => void resolve(value), DEBOUNCE_MS);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFocused(false);
    if (resolvable) void resolve(link);
  };

  // ── Feedback line ──────────────────────────────────────────────────────
  const current = link.trim();
  let feedback: Feedback = parseFeedback(parsed, link, focused);
  if (resolvable && resolving) {
    feedback = { tone: "neutral", text: `${feedback?.text ?? ""} Finding it…`.trim() };
  } else if (resolvable && resolveError && checkedLink === current) {
    feedback = { tone: "error", text: resolveErrorText(resolveError) };
  } else if (resolvable && song && checkedLink === current && !resolveError) {
    feedback = { tone: "ok", text: `Found it: ${displayTrackTitle(song.title)}${song.artist ? ` by ${song.artist}` : ""}.` };
  }

  const canSave = dirty && Boolean(song) && !saving && !resolving;

  const save = async () => {
    if (!canSave || !song) return;
    setSaving(true);
    setSaveError(null);
    const res = await services.content.save(token, song);
    setSaving(false);
    if (!res.ok) {
      const msg = saveErrorText(res.error);
      setSaveError(msg);
      toast("The song didn't save", { tone: "error", body: msg });
      return;
    }
    setBaseline(res.data.content);
    setSong(res.data.content);
    setSyncedVersion(res.data.version);
    toast(SAVED_TOAST, { tone: "success", body: `${displayTrackTitle(res.data.content.title)} is in the envelope.` });
    refresh();
  };

  const discard = () => {
    clearTimeout(timer.current);
    requestId.current += 1;
    setSong(baseline);
    setLink(baseline?.url ?? "");
    setCheckedLink(baseline?.url ?? "");
    setResolveError(null);
    setResolving(false);
  };

  let status: string;
  let tone: SaveTone = "neutral";
  if (saving) {
    status = "Saving…";
    tone = "busy";
  } else if (resolving) {
    status = "Finding the song…";
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
    status = song ? "Unsaved changes" : "Paste a song link to begin";
  }

  return (
    <SenderShell token={token} title={TITLE} kind="song" lede={<>One song that sounds like the two of you, from Spotify or Apple Music.</>} dock={<SaveDock status={status} tone={tone} canSave={canSave} saving={saving} onSave={save} />}>
      <UnsavedGuard dirty={dirty} onDiscard={discard} />

      <form onSubmit={onSubmit} className="mt-5" noValidate>
        <StampedInput
          label="Song link"
          font="ui"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Paste a Spotify or Apple Music link"
          value={link}
          onChange={(e) => onChange(e.target.value)}
          onPaste={() => {
            pasted.current = true;
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          hint={SHARE_HOW}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <p className="ss-parse min-w-0 flex-1" data-tone={feedback?.tone} aria-live="polite">
            {feedback ? (
              <>
                {feedback.tone === "ok" ? <IconCheck size={18} /> : feedback.tone === "error" || feedback.tone === "warn" ? <IconWarning size={18} /> : null}
                <span>{feedback.text}</span>
              </>
            ) : null}
          </p>
          {resolvable && resolveError?.code === "network" && checkedLink === current ? (
            <InkButton variant="secondary" onClick={() => void resolve(link)} icon={<IconRefresh size={16} />}>
              Try again
            </InkButton>
          ) : resolvable && !resolving && checkedLink !== current ? (
            <InkButton type="submit" variant="secondary" icon={<IconSearch size={16} />}>
              Find song
            </InkButton>
          ) : null}
        </div>
      </form>

      {song ? (
        <SongCard
          key={`${song.provider}:${song.trackId}`}
          song={song}
          label={current && checkedLink !== current ? "Keeping this one for now" : current && resolveError ? "Keeping this one for now" : dirty ? "Ready to save" : "In your envelope"}
        />
      ) : null}

      <p className="mt-5 text-sm leading-relaxed text-ink-faded">
        Listeners who aren&apos;t logged in to Spotify or Apple Music hear a 30-second preview.
      </p>

      {record ? (
        <RemoveStamp
          token={token}
          kind="song"
          status={env.unit.status}
          onRemoved={() => {
            setBaseline(null);
            setSong(null);
            setLink("");
          }}
        />
      ) : null}
    </SenderShell>
  );
}

function SongCard({ song, label }: { song: SongContent; label: string }) {
  const title = displayTrackTitle(song.title);
  return (
    <PaperSheet as="section" aria-label="The song" edge="deckled" seed={17} className="ss-song-card ss-rise" wrapperClassName="mt-6">
      <p className="postal-label self-start text-ink-faded">{label}</p>
      <Vinyl playing={false} artworkUrl={song.artworkUrl} title={song.title} artist={song.artist} size={232} />
      <div className="text-center">
        <p className="ss-song-card__provider">{PROVIDER_NAME[song.provider]}</p>
        <p className="mt-1 font-display text-2xl leading-tight text-ink">{title}</p>
        {song.artist ? <p className="mt-0.5 text-lg font-medium text-ink-soft">{song.artist}</p> : null}
      </div>
      <InkLink href={song.url} target="_blank" variant="quiet" icon={<IconExternal size={16} />}>
        Listen in {PROVIDER_NAME[song.provider]}
      </InkLink>
    </PaperSheet>
  );
}
