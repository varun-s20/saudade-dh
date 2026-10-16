/**
 * Song health (ARCHITECTURE.md §11, "graceful degradation"). Every song saved into an envelope is
 * recorded in `song_catalog`; a daily job asks the provider whether each track still exists. A
 * track that disappears is shown as a labelled record (title and artist in our type, no broken
 * embed) via `SongContent.unavailable`, and the sender's portal suggests choosing another.
 *
 * Only a definite "not found" from the provider marks a song unavailable; timeouts and errors
 * change nothing (one bad night at Spotify must not take songs off every envelope).
 */
import "server-only";
import type { ContentMap, SongContent } from "@/lib/services/types";
import { itunesLookupUrl, parseItunesLookup, spotifyOembedUrl } from "@/lib/services/api/song-providers";
import { sql, type Tx } from "./db";

type Db = ReturnType<typeof sql> | Tx;

/** Upsert the catalog row for a song just saved (it is, by definition, available right now). */
export async function recordSong(db: Db, song: SongContent): Promise<void> {
  await db`
    insert into song_catalog (provider, track_id, title, artist, artwork_url, available, unavailable_since, last_checked_at)
    values (${song.provider}, ${song.trackId}, ${song.title.slice(0, 200)}, ${song.artist.slice(0, 200)},
            ${song.artworkUrl?.slice(0, 500) ?? null}, true, null, now())
    on conflict (provider, track_id) do update
      set title = excluded.title, artist = excluded.artist, artwork_url = excluded.artwork_url,
          available = true, unavailable_since = null, last_checked_at = now()`;
}

/** The envelope's contents with `song.unavailable` set from the catalog. */
export async function withSongAvailability(db: Db, map: ContentMap): Promise<ContentMap> {
  const rec = map.song;
  if (!rec) return map;
  const song = rec.content;
  const [row] = await db<{ available: boolean }[]>`
    select available from song_catalog where provider = ${song.provider} and track_id = ${song.trackId}`;
  const unavailable = row ? !row.available : false;
  if (Boolean(song.unavailable) === unavailable) return map;
  return { ...map, song: { ...rec, content: { ...song, unavailable } } };
}

type Verdict = "available" | "gone" | "unknown";

async function fetchStatus(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { headers: { accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
}

async function checkSpotify(trackId: string): Promise<Verdict> {
  const res = await fetchStatus(spotifyOembedUrl(trackId));
  if (!res) return "unknown";
  if (res.ok) return "available";
  return res.status === 404 ? "gone" : "unknown";
}

async function checkApple(trackId: string, storefront?: string): Promise<Verdict> {
  for (const country of storefront ? [storefront, undefined] : [undefined]) {
    const res = await fetchStatus(itunesLookupUrl(trackId, country));
    if (!res || !res.ok) return "unknown";
    const body = (await res.json().catch(() => null)) as unknown;
    if (body === null) return "unknown";
    if (parseItunesLookup(body, trackId).status === "ok") return "available";
  }
  return "gone";
}

export interface SongCheckSummary {
  checked: number;
  gone: number;
  back: number;
  unknown: number;
}

/**
 * Re-check every track currently in an envelope that wasn't checked in the last 20 hours.
 * About one request per track per day; stops at the deadline and carries on tomorrow.
 */
export async function checkSongs(opts: { deadlineMs: number; max: number }): Promise<SongCheckSummary> {
  const summary: SongCheckSummary = { checked: 0, gone: 0, back: 0, unknown: 0 };
  const due = await sql()<{ provider: "spotify" | "apple"; track_id: string; storefront: string | null; title: string; artist: string; available: boolean | null }[]>`
    select distinct on (c.payload ->> 'provider', c.payload ->> 'trackId')
           c.payload ->> 'provider' as provider, c.payload ->> 'trackId' as track_id, c.payload ->> 'storefront' as storefront,
           c.payload ->> 'title' as title, coalesce(c.payload ->> 'artist', '') as artist, s.available
    from current_contents c
    left join song_catalog s on s.provider = c.payload ->> 'provider' and s.track_id = c.payload ->> 'trackId'
    where c.kind = 'song' and (s.last_checked_at is null or s.last_checked_at < now() - interval '20 hours')
    order by c.payload ->> 'provider', c.payload ->> 'trackId'
    limit ${opts.max}`;

  for (const t of due) {
    if (Date.now() > opts.deadlineMs) break;
    const verdict = t.provider === "spotify" ? await checkSpotify(t.track_id) : await checkApple(t.track_id, t.storefront ?? undefined);
    summary.checked++;
    if (verdict === "unknown") {
      summary.unknown++;
      continue;
    }
    const available = verdict === "available";
    if (!available && t.available !== false) summary.gone++;
    if (available && t.available === false) summary.back++;
    await sql()`
      insert into song_catalog (provider, track_id, title, artist, available, unavailable_since, last_checked_at)
      values (${t.provider}, ${t.track_id}, ${t.title.slice(0, 200)}, ${t.artist.slice(0, 200)}, ${available},
              ${available ? null : new Date()}, now())
      on conflict (provider, track_id) do update
        set available = excluded.available, last_checked_at = now(),
            unavailable_since = case when excluded.available then null else coalesce(song_catalog.unavailable_since, now()) end`;
  }
  return summary;
}
