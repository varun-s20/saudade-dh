/**
 * Spotify / Apple Music link parsing. Pure functions, no network.
 * Short links (spotify.link, spoti.fi, apple.co) need a server-side redirect follow:
 * see app/api/song/resolve/route.ts. Metadata (title/artist/artwork) is fetched there too.
 *
 * Launch accepts single tracks only (DECISIONS.md D-012); albums, playlists and podcasts
 * get a friendly "share a single song" message.
 */
import type { SongProvider } from "@/lib/services/types";

export type ParsedSong =
  | { type: "track"; provider: "spotify"; trackId: string; url: string; embedUrl: string; uri: string }
  | {
      type: "track";
      provider: "apple";
      trackId: string;
      albumId?: string;
      storefront: string;
      url: string;
      embedUrl: string;
    }
  | { type: "short"; provider: SongProvider; url: string }
  | { type: "not_a_track"; provider: SongProvider; what: "album" | "playlist" | "artist" | "podcast" | "other" }
  | { type: "unsupported" }
  | { type: "empty" };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

function toUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

export function spotifyEmbedUrl(trackId: string): string {
  return `https://open.spotify.com/embed/track/${trackId}?utm_source=saudade&theme=0`;
}

/**
 * music.apple.com sends X-Frame-Options: DENY, so swap the host for embed.music.apple.com and
 * keep the original path (incl. the name slug) and only the ?i= track param (RESEARCH.md §4).
 */
export function appleEmbedUrl(url: URL): string {
  const i = url.searchParams.get("i");
  const path = url.pathname.replace(/\/id(\d+)(?=\/|$)/g, "/$1");
  return `https://embed.music.apple.com${path}${i ? `?i=${i}` : ""}`;
}

function parseSpotifyUri(s: string): ParsedSong | null {
  const m = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})$/.exec(s.trim());
  if (!m) return null;
  if (m[1] !== "track") {
    return { type: "not_a_track", provider: "spotify", what: m[1] === "episode" || m[1] === "show" ? "podcast" : (m[1] as "album" | "playlist" | "artist") };
  }
  return spotifyTrack(m[2]);
}

function spotifyTrack(trackId: string): ParsedSong {
  return {
    type: "track",
    provider: "spotify",
    trackId,
    url: `https://open.spotify.com/track/${trackId}`,
    embedUrl: spotifyEmbedUrl(trackId),
    uri: `spotify:track:${trackId}`,
  };
}

export function parseSongLink(raw: string): ParsedSong {
  if (!raw.trim()) return { type: "empty" };

  const uri = parseSpotifyUri(raw);
  if (uri) return uri;

  const url = toUrl(raw);
  if (!url) return { type: "unsupported" };
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  // ── Spotify ──
  if (host === "spotify.link" || host === "spoti.fi" || host === "spotify.app.link") {
    return { type: "short", provider: "spotify", url: url.toString() };
  }
  if (host === "open.spotify.com" || host === "play.spotify.com") {
    // Drop locale segment: /intl-fr/track/{id}; also /embed/track/{id}
    const p = parts.filter((seg) => !/^intl-[a-z-]+$/i.test(seg) && seg !== "embed");
    const [what, id] = p;
    if (what === "track" && id && SPOTIFY_ID.test(id)) return spotifyTrack(id);
    if (what === "album" || what === "playlist" || what === "artist") {
      return { type: "not_a_track", provider: "spotify", what };
    }
    if (what === "episode" || what === "show") return { type: "not_a_track", provider: "spotify", what: "podcast" };
    return { type: "not_a_track", provider: "spotify", what: "other" };
  }

  // ── Apple Music ──
  if (host === "apple.co") return { type: "short", provider: "apple", url: url.toString() };
  if (host === "music.apple.com" || host === "geo.music.apple.com" || host === "embed.music.apple.com" || host === "itunes.apple.com") {
    const storefront = parts[0] && /^[a-z]{2}$/i.test(parts[0]) ? parts[0].toLowerCase() : "us";
    const rest = parts[0] && /^[a-z]{2}$/i.test(parts[0]) ? parts.slice(1) : parts;
    const what = rest[0];
    const lastNumeric = [...rest].reverse().find((seg) => /^(id)?\d+$/.test(seg))?.replace(/^id/, "");
    const i = url.searchParams.get("i");

    if (what === "album" && i && /^\d+$/.test(i)) {
      return {
        type: "track",
        provider: "apple",
        trackId: i,
        albumId: lastNumeric,
        storefront,
        url: url.toString(),
        embedUrl: appleEmbedUrl(url),
      };
    }
    if (what === "song" && lastNumeric) {
      return {
        type: "track",
        provider: "apple",
        trackId: lastNumeric,
        storefront,
        url: url.toString(),
        embedUrl: appleEmbedUrl(url),
      };
    }
    if (what === "album") return { type: "not_a_track", provider: "apple", what: "album" };
    if (what === "playlist") return { type: "not_a_track", provider: "apple", what: "playlist" };
    if (what === "artist") return { type: "not_a_track", provider: "apple", what: "artist" };
    return { type: "not_a_track", provider: "apple", what: "other" };
  }

  return { type: "unsupported" };
}
