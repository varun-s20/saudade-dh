/**
 * Song provider metadata: pure parsers, URL builders and a browser-safe resolver, shared by
 *
 *   - app/api/song/resolve/route.ts   server resolver (primary path; follows short links and
 *                                     reads the Spotify track page for the artist)
 *   - lib/services/mock/content.ts    client fallback when the API route is unreachable
 *                                     (CORS-enabled endpoints only: Spotify oEmbed, iTunes Lookup)
 *   - lib/services/api/content.ts     validation of the API response
 *
 * Verified live on 8 Oct 2026 (see public/demo/song.json notes and docs/ARCHITECTURE.md §Song):
 *   - Spotify oEmbed: title + 300 px thumbnail, CORS `*`, no artist. 404 for unknown track ids.
 *   - Spotify track page (server only, no CORS): <meta name="music:musician_description"> holds
 *     the artist(s) ("Lady Gaga, Bradley Cooper"), og:description is "Artist · Album · Song · Year",
 *     music:duration is seconds, og:image is 640 px. All inside the first ~30 KB (<head>).
 *   - iTunes Lookup: CORS `*`, `wrapperType: "track"` + `kind: "song"` for songs,
 *     `wrapperType: "collection"` for album ids, `resultCount: 0` for unknown ids.
 *
 * No secrets, no `any`. Safe to import on the server and in the browser.
 */
import type { ParsedSong } from "@/lib/parsing/songs";
import { appleEmbedUrl, spotifyEmbedUrl } from "@/lib/parsing/songs";
import type { SongContent } from "@/lib/services/types";

// ─── Limits & allowlists ───────────────────────────────────────────────────

/** Longest link we accept from a sender (real share links are < 200 chars). */
export const SONG_LINK_MAX_CHARS = 512;

/** The ONLY hosts the server resolver may fetch (SSRF guard), including every redirect hop. */
export const SONG_FETCH_HOSTS: ReadonlySet<string> = new Set([
  "open.spotify.com",
  "spotify.link",
  "spoti.fi",
  "spotify.app.link",
  "music.apple.com",
  "geo.music.apple.com",
  "apple.co",
  "itunes.apple.com",
]);

/** https only, default port, no credentials, allowlisted host. */
export function isAllowedSongFetchUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    SONG_FETCH_HOSTS.has(url.hostname.toLowerCase())
  );
}

/** Artwork must come from the providers' image CDNs (matches next.config.ts images.remotePatterns). */
export function isAllowedArtworkUrl(raw: string | undefined): raw is string {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      (h === "i.scdn.co" || h.endsWith(".spotifycdn.com") || h.endsWith(".mzstatic.com"))
    );
  } catch {
    return false;
  }
}

// ─── Result type ───────────────────────────────────────────────────────────

export type SongResolveErrorCode = "unsupported_link" | "not_found" | "network";

export type SongResolution =
  | { ok: true; song: SongContent }
  | { ok: false; code: SongResolveErrorCode; detail: string };

export const resolved = (song: SongContent): SongResolution => ({ ok: true, song });
export const unresolved = (code: SongResolveErrorCode, detail: string): SongResolution => ({ ok: false, code, detail });

/** Map a parse result that is not a track to the contract's error. */
export function rejectParsed(parsed: Exclude<ParsedSong, { type: "track" } | { type: "short" }>): SongResolution {
  switch (parsed.type) {
    case "empty":
      return unresolved("unsupported_link", "empty link");
    case "unsupported":
      return unresolved("unsupported_link", "not a Spotify or Apple Music link");
    case "not_a_track":
      return unresolved("unsupported_link", `${parsed.provider} ${parsed.what}: only single songs are supported`);
  }
}

// ─── Small text helpers ────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode the HTML entities that appear in meta content attributes ("Simon &amp; Garfunkel"). */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1] === "x" || entity[1] === "X";
      const cp = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Collapse whitespace, strip control characters, cap length. */
export function cleanText(s: string | undefined, max = 200): string {
  if (!s) return "";
  return s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Collect <meta property|name="…" content="…"> pairs. Keys are lower-cased; values decoded.
 * A key may repeat (e.g. og:restrictions:country:allowed), so values are arrays.
 */
export function extractMetaTags(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const tagRe = /<meta\b[^>]*>/gi;
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const tag of html.match(tagRe) ?? []) {
    const attrs = new Map<string, string>();
    for (const m of tag.matchAll(attrRe)) attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? "");
    const key = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
    const content = attrs.get("content");
    if (!key || content === undefined) continue;
    const list = out.get(key) ?? [];
    list.push(decodeHtmlEntities(content));
    out.set(key, list);
  }
  return out;
}

const firstMeta = (meta: Map<string, string[]>, key: string): string | undefined => meta.get(key)?.[0];

// ─── Spotify ───────────────────────────────────────────────────────────────

export const spotifyTrackUrl = (trackId: string) => `https://open.spotify.com/track/${trackId}`;

export const spotifyOembedUrl = (trackId: string) =>
  `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(trackId))}`;

export interface SpotifyOembed {
  title: string;
  thumbnailUrl?: string;
}

/** Validate the oEmbed JSON (no artist field exists in it). */
export function parseSpotifyOembed(json: unknown): SpotifyOembed | null {
  if (typeof json !== "object" || json === null) return null;
  const rec = json as Record<string, unknown>;
  const title = typeof rec.title === "string" ? cleanText(rec.title) : "";
  if (!title) return null;
  const thumb = typeof rec.thumbnail_url === "string" ? rec.thumbnail_url : undefined;
  return { title, thumbnailUrl: isAllowedArtworkUrl(thumb) ? thumb : undefined };
}

export interface SpotifyPageMeta {
  title?: string;
  artist?: string;
  artworkUrl?: string;
  durationMs?: number;
  /** og:type, "music.song" for tracks. */
  type?: string;
}

/**
 * Read what a Spotify track page exposes in <head>. Artist preference:
 *   1. music:musician_description (all values, de-duplicated)
 *   2. first segment of og:description / twitter:description ("Artist · Album · Song · 1969")
 *   3. <title> "… - song and lyrics by Artist | Spotify"
 */
export function parseSpotifyTrackPage(html: string): SpotifyPageMeta {
  const meta = extractMetaTags(html);

  let artist = [...new Set((meta.get("music:musician_description") ?? []).map((s) => cleanText(s)).filter(Boolean))].join(", ");
  if (!artist) {
    const desc = firstMeta(meta, "og:description") ?? firstMeta(meta, "twitter:description");
    const parts = desc ? desc.split(/\s+[·•]\s+/) : [];
    if (parts.length >= 3) artist = cleanText(parts[0]);
  }
  if (!artist) {
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1];
    const m = title ? / - song(?: and lyrics)? by (.+?) \| Spotify\s*$/i.exec(decodeHtmlEntities(title)) : null;
    if (m) artist = cleanText(m[1]);
  }

  const seconds = Number(firstMeta(meta, "music:duration"));
  const image = firstMeta(meta, "og:image") ?? firstMeta(meta, "twitter:image");

  return {
    title: cleanText(firstMeta(meta, "og:title") ?? firstMeta(meta, "twitter:title")) || undefined,
    artist: artist || undefined,
    artworkUrl: isAllowedArtworkUrl(image) ? image : undefined,
    durationMs: Number.isFinite(seconds) && seconds > 0 && seconds < 86_400 ? Math.round(seconds * 1000) : undefined,
    type: firstMeta(meta, "og:type"),
  };
}

export function buildSpotifySong(input: {
  trackId: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  durationMs?: number;
}): SongContent {
  return {
    kind: "song",
    provider: "spotify",
    url: spotifyTrackUrl(input.trackId),
    trackId: input.trackId,
    title: cleanText(input.title),
    artist: cleanText(input.artist),
    artworkUrl: isAllowedArtworkUrl(input.artworkUrl) ? input.artworkUrl : undefined,
    durationMs: input.durationMs,
    embedUrl: spotifyEmbedUrl(input.trackId),
  };
}

// ─── Apple Music ───────────────────────────────────────────────────────────

/** iTunes Lookup. `country` keeps the storefront consistent with the pasted link. */
export const itunesLookupUrl = (trackId: string, country?: string) =>
  `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}${country ? `&country=${encodeURIComponent(country)}` : ""}`;

export interface ItunesTrack {
  trackId: string;
  trackName: string;
  artistName: string;
  collectionId?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
}

export type ItunesLookupResult =
  | { status: "ok"; track: ItunesTrack }
  | { status: "not_found" }
  | { status: "not_a_song"; what: string };

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Validate an iTunes Lookup response for a given track id. */
export function parseItunesLookup(json: unknown, trackId: string): ItunesLookupResult {
  if (typeof json !== "object" || json === null) return { status: "not_found" };
  const results = (json as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return { status: "not_found" };

  for (const item of results) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const wrapper = str(r.wrapperType);
    if (wrapper !== "track") {
      // An album / artist id was passed where a track id was expected.
      if (String(num(r.collectionId) ?? num(r.artistId) ?? "") === trackId) return { status: "not_a_song", what: wrapper ?? "other" };
      continue;
    }
    if (String(num(r.trackId) ?? "") !== trackId) continue;
    const kind = str(r.kind);
    if (kind !== "song") return { status: "not_a_song", what: kind ?? "other" };
    const trackName = cleanText(str(r.trackName));
    if (!trackName) return { status: "not_found" };
    const collectionId = num(r.collectionId);
    return {
      status: "ok",
      track: {
        trackId,
        trackName,
        artistName: cleanText(str(r.artistName)),
        collectionId: collectionId !== undefined ? String(collectionId) : undefined,
        artworkUrl100: str(r.artworkUrl100),
        trackTimeMillis: num(r.trackTimeMillis),
        trackViewUrl: str(r.trackViewUrl),
      },
    };
  }
  return { status: "not_found" };
}

/** mzstatic artwork URLs end in "/100x100bb.jpg"; the size segment can be swapped (600 verified). */
export function upscaleAppleArtwork(raw: string | undefined, size = 600): string | undefined {
  if (!isAllowedArtworkUrl(raw)) return undefined;
  return raw.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.jpg`);
}

/**
 * Canonical music.apple.com URL for storage and the embed: host normalised (geo./embed./itunes.),
 * legacy "/id123" path segments unwrapped, and every query param dropped except ?i= (track).
 */
export function canonicalAppleUrl(input: string | URL): URL {
  const src = typeof input === "string" ? new URL(input) : input;
  const out = new URL("https://music.apple.com");
  out.pathname = src.pathname.replace(/\/id(\d+)(?=\/|$)/g, "/$1");
  const i = src.searchParams.get("i");
  if (i && /^\d+$/.test(i)) out.searchParams.set("i", i);
  return out;
}

export function buildAppleSong(input: {
  parsed: Extract<ParsedSong, { type: "track"; provider: "apple" }>;
  track: ItunesTrack;
}): SongContent {
  const { parsed, track } = input;
  const canonical = canonicalAppleUrl(parsed.url);
  return {
    kind: "song",
    provider: "apple",
    url: canonical.toString(),
    trackId: parsed.trackId,
    albumId: parsed.albumId ?? track.collectionId,
    storefront: parsed.storefront,
    title: track.trackName,
    artist: track.artistName,
    artworkUrl: upscaleAppleArtwork(track.artworkUrl100),
    durationMs: track.trackTimeMillis,
    embedUrl: appleEmbedUrl(canonical),
  };
}

// ─── Short links ───────────────────────────────────────────────────────────

const SPOTIFY_IN_TEXT =
  /https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:track|album|playlist|episode|show|artist)\/[A-Za-z0-9]{22}/i;
const APPLE_IN_TEXT = /https?:\/\/(?:geo\.)?music\.apple\.com\/[a-z]{2}\/(?:album|song|playlist|artist)\/[^\s"'<>\\]+/i;

/**
 * After following a short link, find the canonical music URL: first the final URL itself, then
 * og:url / al:web_url, then the first canonical-looking URL anywhere in the body (the
 * spotify.app.link interstitial embeds it in markup and JSON with escaped slashes).
 */
export function findCanonicalMusicUrl(finalUrl: string, body: string): string | null {
  try {
    const u = new URL(finalUrl);
    if (u.hostname === "open.spotify.com" && SPOTIFY_IN_TEXT.test(u.toString())) return u.toString();
    if ((u.hostname === "music.apple.com" || u.hostname === "geo.music.apple.com") && APPLE_IN_TEXT.test(u.toString())) {
      return u.toString();
    }
  } catch {
    // fall through to the body
  }
  const text = body.replace(/\\\//g, "/");
  const meta = extractMetaTags(text);
  for (const key of ["og:url", "al:web_url", "twitter:url"]) {
    const v = firstMeta(meta, key);
    if (v && (SPOTIFY_IN_TEXT.test(v) || APPLE_IN_TEXT.test(v))) return v;
  }
  const hit = SPOTIFY_IN_TEXT.exec(text) ?? APPLE_IN_TEXT.exec(text);
  return hit ? decodeHtmlEntities(hit[0]) : null;
}

// ─── Browser-safe resolver (CORS endpoints only) ───────────────────────────

/**
 * Resolve an already-parsed track using only CORS-enabled public endpoints. Used as the client
 * fallback when /api/song/resolve is unreachable. Spotify artist stays empty (oEmbed has none);
 * short links cannot be resolved here (spotify.link sends no CORS headers).
 */
export async function resolveTrackViaPublicApis(
  parsed: Extract<ParsedSong, { type: "track" }>,
  timeoutMs = 6000,
): Promise<SongResolution> {
  try {
    if (parsed.provider === "spotify") {
      const res = await fetch(spotifyOembedUrl(parsed.trackId), { signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404 || res.status === 400) return unresolved("not_found", `spotify oEmbed ${res.status}`);
      if (!res.ok) return unresolved("network", `spotify oEmbed ${res.status}`);
      const o = parseSpotifyOembed(await res.json());
      if (!o) return unresolved("network", "spotify oEmbed: unexpected body");
      return resolved(buildSpotifySong({ trackId: parsed.trackId, title: o.title, artworkUrl: o.thumbnailUrl }));
    }

    const lookup = async (country?: string) => {
      const res = await fetch(itunesLookupUrl(parsed.trackId, country), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return null;
      return parseItunesLookup(JSON.parse(await res.text()) as unknown, parsed.trackId);
    };
    let r = await lookup(parsed.storefront);
    if (r?.status === "not_found" && parsed.storefront !== "us") r = await lookup();
    if (!r) return unresolved("network", "itunes lookup failed");
    if (r.status === "not_found") return unresolved("not_found", "itunes lookup: no such track");
    if (r.status === "not_a_song") return unresolved("unsupported_link", `apple ${r.what}: only single songs are supported`);
    return resolved(buildAppleSong({ parsed, track: r.track }));
  } catch (e) {
    return unresolved("network", e instanceof Error ? e.name : "fetch failed");
  }
}

// ─── Response validation ───────────────────────────────────────────────────

const EMBED_PREFIXES = ["https://open.spotify.com/embed/", "https://embed.music.apple.com/"];

/** Runtime guard for SongContent coming over the wire (the embed URL becomes an iframe src). */
export function isSongContent(x: unknown): x is SongContent {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const optStr = (v: unknown) => v === undefined || typeof v === "string";
  return (
    r.kind === "song" &&
    (r.provider === "spotify" || r.provider === "apple") &&
    typeof r.url === "string" &&
    typeof r.trackId === "string" &&
    typeof r.title === "string" &&
    typeof r.artist === "string" &&
    typeof r.embedUrl === "string" &&
    EMBED_PREFIXES.some((p) => (r.embedUrl as string).startsWith(p)) &&
    optStr(r.albumId) &&
    optStr(r.storefront) &&
    optStr(r.artworkUrl) &&
    (r.durationMs === undefined || typeof r.durationMs === "number")
  );
}
