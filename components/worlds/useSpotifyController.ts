"use client";

/**
 * Spotify iFrame API (RESEARCH §4.7): the official embed, plus playback events so the vinyl spins
 * only while music really plays.
 *
 *   script   https://open.spotify.com/embed/iframe-api/v1 (loaded once per page, on first use)
 *   ready    window.onSpotifyIframeApiReady(IFrameAPI)
 *   create   IFrameAPI.createController(element, { uri, width, height }, callback)
 *   events   ready · playback_started · playback_update { isPaused, isBuffering, position, duration }
 *
 * The API replaces the element it is given with its iframe, so the hook hands it a throwaway
 * <div> appended inside a React-owned host (React never reconciles the API's DOM). If the script
 * or the embed doesn't become ready in time (blocked, offline, CSP), status becomes "failed" and
 * the caller falls back to a plain iframe of `embedUrl`.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

export interface SpotifyPlaybackUpdate {
  isPaused: boolean;
  isBuffering: boolean;
  /** ms */
  position: number;
  /** ms */
  duration: number;
  playingURI?: string;
}

interface SpotifyEvent {
  data?: Partial<SpotifyPlaybackUpdate> & { playingURI?: string };
}

export interface SpotifyEmbedController {
  addListener(event: "ready" | "playback_started" | "playback_update", cb: (e: SpotifyEvent) => void): void;
  togglePlay(): void;
  play(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: number | string; height?: number | string },
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

type SpotifyWindow = Window & { onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void };

let loadedApi: SpotifyIFrameAPI | null = null;
let pending: Promise<SpotifyIFrameAPI> | null = null;

/** Load the iFrame API script once. Rejects on a load error or after `timeoutMs`. */
export function loadSpotifyIframeApi(timeoutMs = 8000): Promise<SpotifyIFrameAPI> {
  if (loadedApi) return Promise.resolve(loadedApi);
  if (pending) return pending;
  pending = new Promise<SpotifyIFrameAPI>((resolve, reject) => {
    const w = window as SpotifyWindow;
    const previous = w.onSpotifyIframeApiReady;
    w.onSpotifyIframeApiReady = (api) => {
      loadedApi = api;
      previous?.(api);
      resolve(api);
    };
    let script = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const s = script;
    s.addEventListener(
      "error",
      () => {
        pending = null;
        s.remove();
        reject(new Error("Spotify iFrame API failed to load"));
      },
      { once: true },
    );
    window.setTimeout(() => {
      if (loadedApi) return;
      pending = null;
      reject(new Error("Spotify iFrame API timed out"));
    }, timeoutMs);
  });
  return pending;
}

export type SpotifyStatus = "idle" | "loading" | "ready" | "failed";

export interface SpotifyPlayback {
  /** True only while music is actually coming out (not paused, past the initial buffering). */
  playing: boolean;
  buffering: boolean;
  /** ms */
  position: number;
  /** ms */
  duration: number;
}

export interface SpotifyEventLog {
  ready: boolean;
  started: number;
  updates: number;
}

const IDLE: SpotifyPlayback = { playing: false, buffering: false, position: 0, duration: 0 };

export function useSpotifyController({
  uri,
  enabled,
  title,
  height = 152,
  timeoutMs = 10000,
}: {
  /** "spotify:track:{id}" */
  uri: string;
  enabled: boolean;
  /** Accessible title for the embed's iframe (the API doesn't set one). */
  title: string;
  height?: number;
  timeoutMs?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const [status, setStatus] = useState<SpotifyStatus>(enabled ? "loading" : "idle");
  const [playback, setPlayback] = useState<SpotifyPlayback>(IDLE);
  const [events, setEvents] = useState<SpotifyEventLog>({ ready: false, started: 0, updates: 0 });

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let ready = false;
    let controller: SpotifyEmbedController | null = null;
    const mount = document.createElement("div");
    host.replaceChildren(mount);

    const fail = () => {
      if (cancelled || ready) return;
      cancelled = true;
      controller?.destroy();
      controllerRef.current = null;
      host.replaceChildren();
      setStatus("failed");
    };
    const timer = window.setTimeout(fail, timeoutMs);

    loadSpotifyIframeApi().then((api) => {
      if (cancelled) return;
      try {
        api.createController(mount, { uri, width: "100%", height }, (c) => {
          if (cancelled) {
            c.destroy();
            return;
          }
          controller = c;
          controllerRef.current = c;
          host.querySelector("iframe")?.setAttribute("title", title);
          c.addListener("ready", () => {
            if (cancelled) return;
            ready = true;
            window.clearTimeout(timer);
            setStatus("ready");
            setEvents((e) => ({ ...e, ready: true }));
          });
          c.addListener("playback_started", () => {
            if (!cancelled) setEvents((e) => ({ ...e, started: e.started + 1 }));
          });
          c.addListener("playback_update", (e) => {
            if (cancelled || !e.data) return;
            const isPaused = Boolean(e.data.isPaused);
            const isBuffering = Boolean(e.data.isBuffering);
            const position = Number(e.data.position) || 0;
            const duration = Number(e.data.duration) || 0;
            // Spin once sound is really coming out; a mid-song buffering blip keeps it turning.
            const playing = !isPaused && (!isBuffering || position > 0);
            setPlayback((p) =>
              p.playing === playing && p.buffering === isBuffering && Math.abs(p.position - position) < 250 && p.duration === duration
                ? p
                : { playing, buffering: isBuffering, position, duration },
            );
            setEvents((ev) => ({ ...ev, updates: ev.updates + 1 }));
          });
        });
      } catch {
        fail();
      }
    }, fail);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.destroy();
      controllerRef.current = null;
      host.replaceChildren();
    };
  }, [uri, enabled, title, height, timeoutMs]);

  /** Call from a tap handler only (autoplay rules); `playing` still follows the events. */
  const togglePlay = useCallback(() => controllerRef.current?.togglePlay(), []);

  return { hostRef, status, playback, events, togglePlay };
}
