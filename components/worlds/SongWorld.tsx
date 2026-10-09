"use client";

/**
 * Song world (vinyl, ochre): the record on its turntable with the official player below it.
 *
 *   Spotify      the iFrame API controller: the record spins and the tonearm drops only while
 *                `playback_update` says music is playing. Tapping the record toggles playback
 *                (a real button); the embed's own controls work too.
 *   Apple Music  the official embed has no event API (D-013), so the spin is ambient and honest
 *                about it: it starts when the recipient interacts with the player (the iframe
 *                takes focus), stops after the track's length, and a small "Stop / Spin the
 *                record" toggle is always there.
 *   Fallback     if the Spotify API can't load, a plain iframe of `embedUrl` with the same ambient
 *                behaviour as Apple.
 *   Unavailable  the record and the title stay; the player is replaced by a plain sentence.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { SongContent } from "@/lib/services/types";
import { Vinyl } from "@/components/media/Vinyl";
import { useElementSize } from "@/components/envelope/useElementSize";
import { IconExternal } from "@/components/ui/icons";
import { inkClasses } from "@/components/ui/InkButton";
import { displayTrackTitle } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useSpotifyController } from "./useSpotifyController";
import "./worlds.css";

export interface SongWorldProps {
  song: SongContent;
  fromName?: string | null;
}

/** Official embed heights: Spotify's compact player, Apple's single-song player. */
const SPOTIFY_HEIGHT = 152;
const APPLE_HEIGHT = 175;
/** Apple's recommended sandbox for its embed (RESEARCH §4.8). */
const APPLE_SANDBOX =
  "allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation";
/** Ambient spin without a known track length: about a logged-out preview. */
const AMBIENT_FALLBACK_MS = 30_000;

/**
 * Ambient spin for embeds without events: on when the recipient interacts with the player (the
 * cross-origin iframe takes focus, so the page window blurs), off after `maxMs`, or by hand.
 */
function useAmbientSpin(iframeRef: RefObject<HTMLIFrameElement | null>, enabled: boolean, maxMs: number) {
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const onBlur = () =>
      window.setTimeout(() => {
        if (iframeRef.current && document.activeElement === iframeRef.current) setSpinning(true);
      }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [enabled, iframeRef]);
  useEffect(() => {
    if (!spinning) return;
    const t = window.setTimeout(() => setSpinning(false), maxMs);
    return () => window.clearTimeout(t);
  }, [spinning, maxMs]);
  return [spinning, setSpinning] as const;
}

export function SongWorld({ song, fromName }: SongWorldProps) {
  const title = displayTrackTitle(song.title);
  const artist = song.artist?.trim() || null;
  const provider = song.provider === "spotify" ? "Spotify" : "Apple Music";
  const byline = artist ? `${title} by ${artist}` : title;

  const useApi = song.provider === "spotify" && !song.unavailable;
  const {
    hostRef: spotifyHostRef,
    status: spotifyStatus,
    playback,
    events,
    togglePlay,
  } = useSpotifyController({
    uri: `spotify:track:${song.trackId}`,
    enabled: useApi,
    title: `Spotify player: ${byline}`,
    height: SPOTIFY_HEIGHT,
  });
  const synced = useApi && spotifyStatus === "ready";
  const plainIframe = !song.unavailable && (song.provider === "apple" || spotifyStatus === "failed");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ambient, setAmbient] = useAmbientSpin(iframeRef, plainIframe, song.durationMs && song.durationMs > 0 ? song.durationMs : AMBIENT_FALLBACK_MS);

  const playing = song.unavailable ? false : synced ? playback.playing : plainIframe ? ambient : false;

  const columnRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(columnRef);
  const size = Math.round(Math.max(200, Math.min(320, width - 8)));

  const record = width > 0 ? <Vinyl playing={playing} artworkUrl={song.artworkUrl} title={song.title} artist={artist} size={size} /> : null;

  return (
    <div className="wd-song flex min-h-full flex-col items-center px-5 pt-6 pb-10" data-world="song" data-song-playing={playing ? "true" : "false"}>
      <div ref={columnRef} className="flex w-full max-w-[26rem] flex-col items-center">
        <div className="flex w-full justify-center" style={{ minHeight: size * 0.88 }}>
          {synced ? (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? `Pause ${byline}` : `Play ${byline}`}
              className="wd-record-btn rounded-card"
              data-song-toggle
            >
              {record}
            </button>
          ) : (
            record
          )}
        </div>

        <div className="mt-5 text-center">
          <p className="postal-label text-ochre-ink" aria-live="polite">
            {song.unavailable ? "Side A" : playing ? (synced ? "Now playing" : "Spinning") : "Side A"}
          </p>
          <h3 className="display mt-1 text-[1.45rem] leading-[1.05] text-ink text-balance">{title}</h3>
          {artist ? <p className="mt-0.5 text-lg font-medium text-ink-soft">{artist}</p> : null}
          {fromName ? <p className="mt-2 font-hand text-[1.45rem] leading-tight text-ink-letter">chosen for you by {fromName}</p> : null}
        </div>

        {song.unavailable ? (
          <p className="mt-6 max-w-[22rem] text-center text-ink-soft">This song is no longer available on {provider}. It may have been removed by the artist or the label.</p>
        ) : (
          <>
            <div className="wd-embed mt-6 w-full overflow-hidden rounded-card" style={{ height: song.provider === "apple" && plainIframe ? APPLE_HEIGHT : SPOTIFY_HEIGHT }}>
              {useApi && !plainIframe ? (
                <>
                  {spotifyStatus !== "ready" ? (
                    <p className="wd-embed__wait absolute inset-0 grid place-items-center text-sm text-ink-faded" aria-hidden>
                      Bringing in the {provider} player…
                    </p>
                  ) : null}
                  <div
                    ref={spotifyHostRef}
                    className={cn("relative h-full w-full", spotifyStatus !== "ready" && "opacity-0")}
                    data-spotify-host
                    data-spotify-status={spotifyStatus}
                    data-spotify-ready={events.ready ? "true" : "false"}
                    data-spotify-started={events.started}
                    data-spotify-updates={events.updates}
                  />
                </>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={song.embedUrl}
                  title={`${provider} player: ${byline}`}
                  width="100%"
                  height={song.provider === "apple" ? APPLE_HEIGHT : SPOTIFY_HEIGHT}
                  allow="autoplay *; encrypted-media *; clipboard-write"
                  sandbox={song.provider === "apple" ? APPLE_SANDBOX : undefined}
                  loading="lazy"
                  className="block h-full w-full border-0"
                  data-song-iframe={song.provider}
                />
              )}
            </div>

            {plainIframe ? (
              <button
                type="button"
                onClick={() => setAmbient(!ambient)}
                aria-pressed={ambient}
                className="mt-3 tap-target inline-flex items-center rounded-pill px-3 text-sm text-ochre-ink underline decoration-dotted underline-offset-4"
                data-song-spin
              >
                {ambient ? "Stop the record" : "Spin the record"}
                <span className="sr-only"> (the record doesn&apos;t follow the {provider} player)</span>
              </button>
            ) : null}

            <a
              href={song.url}
              target="_blank"
              rel="noopener noreferrer"
              className={inkClasses("secondary", "md", false, "mt-4")}
              data-song-open
            >
              <span className="sd-ink__face">
                <span className="sd-ink__label">Open in {provider}</span>
                <IconExternal size={18} />
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="mt-3 text-center text-sm text-ink-faded">Not logged in? You&apos;ll hear a 30-second preview.</p>
          </>
        )}
      </div>
    </div>
  );
}
