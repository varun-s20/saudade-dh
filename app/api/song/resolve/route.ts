/**
 * POST /api/song/resolve  { link: string }
 *
 * Turns a pasted Spotify / Apple Music link (incl. spotify.link / spoti.fi / apple.co short links
 * and spotify: URIs) into a SongContent with title, artist, artwork and the official embed URL.
 *
 *   200 SongContent
 *   400 { code: "unsupported_link", detail }   body is not JSON {link: string}
 *   403 { code: "unauthorized", detail }       cross-origin browser request
 *   404 { code: "not_found", detail }          the track does not exist
 *   413 { code: "unsupported_link", detail }   body or link too long
 *   422 { code: "unsupported_link", detail }   not a music link, or not a single track
 *   429 { code: "rate_limited", retryAfterSec } (+ Retry-After header)
 *   502 { code: "network", detail }            provider unreachable / timed out
 *
 * Security: fetches only allowlisted provider hosts over https (every redirect hop is checked;
 * redirects are followed manually), per-fetch timeout, overall time budget, capped response
 * reads, capped request body, best-effort per-IP rate limit, no secrets, no caching.
 *
 * POST handlers are never cached or prerendered, so this route is request-time under
 * `cacheComponents: true` without any segment config (`dynamic` and `runtime` are rejected with
 * Cache Components). See docs/ARCHITECTURE.md §Song.
 */
import type { NextRequest } from "next/server";
import { parseSongLink, type ParsedSong } from "@/lib/parsing/songs";
import {
  buildAppleSong,
  buildSpotifySong,
  findCanonicalMusicUrl,
  isAllowedSongFetchUrl,
  itunesLookupUrl,
  parseItunesLookup,
  parseSpotifyOembed,
  parseSpotifyTrackPage,
  rejectParsed,
  resolved,
  SONG_LINK_MAX_CHARS,
  spotifyOembedUrl,
  spotifyTrackUrl,
  unresolved,
  type SongResolution,
  type SongResolveErrorCode,
} from "@/lib/services/api/song-providers";

// Node.js runtime is the default. Note: `export const runtime` is REJECTED by Next 16.4 when
// `cacheComponents` is on ("Route segment config "runtime" is not compatible"), so don't add it.
export const maxDuration = 20;

// ─── Tunables ──────────────────────────────────────────────────────────────

/** Honest UA. spotify.link answers it with a 307 to the spotify.app.link interstitial. */
const USER_AGENT = "Mozilla/5.0 (compatible; SaudadeSongResolver/1.0)";
const FETCH_TIMEOUT_MS = 6_000;
/** Whole-request budget across every upstream call. */
const TOTAL_BUDGET_MS = 12_000;
const MAX_REDIRECTS = 5;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_HTML_BYTES = 256 * 1024;
const MAX_JSON_BYTES = 64 * 1024;
/** Best-effort, per server instance. Production uses the shared limiter (ARCHITECTURE.md §Security). */
const RATE_LIMIT = { max: 30, windowMs: 60_000 };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// ─── Errors & responses ────────────────────────────────────────────────────

class ResolveFailure extends Error {
  readonly code: SongResolveErrorCode;
  constructor(code: SongResolveErrorCode, detail: string) {
    super(detail);
    this.code = code;
  }
}

const STATUS_BY_CODE: Record<SongResolveErrorCode, number> = {
  unsupported_link: 422,
  not_found: 404,
  network: 502,
};

function reply(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
  });
}

function replyResolution(r: SongResolution): Response {
  if (r.ok) return reply(r.song);
  if (r.code === "network") console.warn(`[song/resolve] upstream failure: ${r.detail}`);
  return reply({ code: r.code, detail: r.detail }, STATUS_BY_CODE[r.code]);
}

// ─── Rate limit (in-memory, per instance) ──────────────────────────────────

const buckets = new Map<string, { count: number; resetAt: number }>();

/** On Vercel both headers are set by the platform (client-supplied values are overwritten). */
function clientKey(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return real || fwd || "local";
}

function rateLimit(key: string, now: number): { ok: true } | { ok: false; retryAfterSec: number } {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { ok: true };
  }
  b.count += 1;
  if (b.count <= RATE_LIMIT.max) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

// ─── Request body ──────────────────────────────────────────────────────────

/** Read at most `max` bytes of a stream; returns null if it is longer. */
async function readLimited(stream: ReadableStream<Uint8Array> | null, max: number): Promise<string | null> {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

// ─── Upstream fetching (SSRF-safe) ─────────────────────────────────────────

interface Fetched {
  url: URL;
  status: number;
  text: string;
}

/**
 * Read up to `maxBytes` of a response body, stopping early once `stopAt` has been seen
 * (e.g. "</head>" for HTML pages where we only need meta tags).
 */
async function readCapped(res: Response, maxBytes: number, stopAt?: string): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (total >= maxBytes || (stopAt && text.includes(stopAt))) {
      await reader.cancel().catch(() => undefined);
      return text;
    }
  }
  return text + decoder.decode();
}

/**
 * GET with manual redirects. Every hop must pass the host allowlist; a hop to any other host is
 * treated as "not a music link" (e.g. apple.co → apps.apple.com).
 */
async function safeGet(
  start: URL,
  opts: { deadline: number; accept: string; maxBytes: number; stopAt?: string },
): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedSongFetchUrl(url)) throw new ResolveFailure("unsupported_link", `redirects outside the music providers (${url.hostname})`);
    const remaining = opts.deadline - Date.now();
    if (remaining <= 0) throw new ResolveFailure("network", "time budget exhausted");

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          "user-agent": USER_AGENT,
          accept: opts.accept,
          "accept-language": "en-US,en;q=0.8",
        },
        signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, remaining)),
      });
    } catch (e) {
      throw new ResolveFailure("network", `${url.hostname}: ${e instanceof Error ? e.name : "fetch failed"}`);
    }

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new ResolveFailure("network", `${url.hostname}: redirect without location`);
      try {
        url = new URL(location, url);
      } catch {
        throw new ResolveFailure("unsupported_link", "malformed redirect");
      }
      continue;
    }

    try {
      const text = await readCapped(res, opts.maxBytes, opts.stopAt);
      return { url, status: res.status, text };
    } catch (e) {
      throw new ResolveFailure("network", `${url.hostname}: ${e instanceof Error ? e.name : "read failed"}`);
    }
  }
  throw new ResolveFailure("unsupported_link", "too many redirects");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

// ─── Resolution steps ──────────────────────────────────────────────────────

/** Follow a short link and parse whatever canonical music URL it lands on. */
async function expandShortLink(parsed: Extract<ParsedSong, { type: "short" }>, deadline: number): Promise<ParsedSong> {
  const page = await safeGet(new URL(parsed.url), {
    deadline,
    accept: "text/html,application/xhtml+xml",
    maxBytes: MAX_HTML_BYTES,
  });
  const found = findCanonicalMusicUrl(page.url.toString(), page.text);
  // An invalid spotify.link code redirects to the open.spotify.com home page (200, no id).
  if (!found) throw new ResolveFailure("unsupported_link", "short link did not lead to a song");
  const next = parseSongLink(found);
  if (next.type === "short") throw new ResolveFailure("unsupported_link", "short link loops");
  return next;
}

async function resolveSpotify(trackId: string, deadline: number): Promise<SongResolution> {
  // oEmbed (official, title + thumbnail) and the track page (artist, duration, 640 px art) in parallel.
  const [oembedRes, pageRes] = await Promise.allSettled([
    safeGet(new URL(spotifyOembedUrl(trackId)), { deadline, accept: "application/json", maxBytes: MAX_JSON_BYTES }),
    safeGet(new URL(spotifyTrackUrl(trackId)), {
      deadline,
      accept: "text/html,application/xhtml+xml",
      maxBytes: MAX_HTML_BYTES,
      stopAt: "</head>",
    }),
  ]);

  const oembed =
    oembedRes.status === "fulfilled" && oembedRes.value.status === 200 ? parseSpotifyOembed(parseJson(oembedRes.value.text)) : null;
  const page =
    pageRes.status === "fulfilled" && pageRes.value.status === 200 ? parseSpotifyTrackPage(pageRes.value.text) : null;

  const oembedMissing = oembedRes.status === "fulfilled" && (oembedRes.value.status === 404 || oembedRes.value.status === 400);
  const pageMissing = pageRes.status === "fulfilled" && pageRes.value.status === 404;

  if (!oembed && (oembedMissing || pageMissing) && !page?.title) {
    return unresolved("not_found", "spotify: no such track");
  }

  const title = oembed?.title || page?.title;
  if (!title) {
    const why = [oembedRes, pageRes]
      .map((r) => (r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : "failed") : `HTTP ${r.value.status}`))
      .join("; ");
    return unresolved("network", `spotify metadata unavailable (${why})`);
  }
  if (page?.type && page.type !== "music.song") {
    return unresolved("unsupported_link", `spotify ${page.type}: only single songs are supported`);
  }

  return resolved(
    buildSpotifySong({
      trackId,
      title,
      // Graceful fallback: an empty artist renders as title-only (never invented).
      artist: page?.artist ?? "",
      artworkUrl: page?.artworkUrl ?? oembed?.thumbnailUrl,
      durationMs: page?.durationMs,
    }),
  );
}

async function resolveApple(
  parsed: Extract<ParsedSong, { type: "track"; provider: "apple" }>,
  deadline: number,
): Promise<SongResolution> {
  const lookup = async (country?: string) => {
    const res = await safeGet(new URL(itunesLookupUrl(parsed.trackId, country)), {
      deadline,
      accept: "application/json,text/javascript",
      maxBytes: MAX_JSON_BYTES,
    });
    if (res.status !== 200) throw new ResolveFailure("network", `itunes lookup HTTP ${res.status}`);
    return parseItunesLookup(parseJson(res.text), parsed.trackId);
  };

  let r = await lookup(parsed.storefront);
  // Some catalogue entries only resolve in the default (US) storefront.
  if (r.status === "not_found" && parsed.storefront !== "us") r = await lookup();
  if (r.status === "not_found") return unresolved("not_found", "apple: no such track");
  if (r.status === "not_a_song") return unresolved("unsupported_link", `apple ${r.what}: only single songs are supported`);
  return resolved(buildAppleSong({ parsed, track: r.track }));
}

async function resolve(link: string): Promise<SongResolution> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let parsed = parseSongLink(link);
  if (parsed.type === "short") parsed = await expandShortLink(parsed, deadline);
  if (parsed.type !== "track") return rejectParsed(parsed.type === "short" ? { type: "unsupported" } : parsed);
  return parsed.provider === "spotify" ? resolveSpotify(parsed.trackId, deadline) : resolveApple(parsed, deadline);
}

// ─── Handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // Same-origin only for browsers (no CORS headers are ever sent, so this is belt and braces).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      // malformed Origin: treat as cross-origin
    }
    if (originHost !== host) return reply({ code: "unauthorized", detail: "cross-origin request" }, 403);
  }

  const limited = rateLimit(clientKey(request), Date.now());
  if (!limited.ok) {
    return reply({ code: "rate_limited", retryAfterSec: limited.retryAfterSec }, 429, {
      "retry-after": String(limited.retryAfterSec),
    });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BYTES) return reply({ code: "unsupported_link", detail: "request too large" }, 413);
  const raw = await readLimited(request.body, MAX_REQUEST_BYTES);
  if (raw === null) return reply({ code: "unsupported_link", detail: "request too large" }, 413);

  const body = parseJson(raw);
  const link =
    typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).link === "string"
      ? ((body as Record<string, unknown>).link as string).trim()
      : null;
  if (link === null) return reply({ code: "unsupported_link", detail: 'expected JSON body {"link": string}' }, 400);
  if (link.length > SONG_LINK_MAX_CHARS) return reply({ code: "unsupported_link", detail: "link too long" }, 413);

  try {
    return replyResolution(await resolve(link));
  } catch (e) {
    if (e instanceof ResolveFailure) return replyResolution(unresolved(e.code, e.message));
    console.error("[song/resolve] unexpected error", e);
    return reply({ code: "network", detail: "unexpected error" }, 502);
  }
}
