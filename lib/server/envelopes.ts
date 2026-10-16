/**
 * Units, contents and the envelopes the screens receive (ARCHITECTURE.md §4–§6), shared by the
 * sender, recipient and admin routes. Mirrors the behaviour of lib/services/mock/* so the screens
 * can't tell the data sources apart (§13), apart from the intentional differences in §13.3.
 */
import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { site } from "@/config/site";
import { summarise } from "@/lib/content-summary";
import { appleEmbedUrl, parseSongLink, spotifyEmbedUrl } from "@/lib/parsing/songs";
import { canonicalAppleUrl, cleanText, isAllowedArtworkUrl, spotifyTrackUrl } from "@/lib/services/api/song-providers";
import type {
  AuditAction,
  ContentMap,
  ContentRecord,
  ContentVersion,
  RecipientEnvelope,
  SenderEnvelope,
  StampContent,
  StampKind,
  UnitStatus,
} from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { iso, isoReq, sql, type Tx } from "./db";
import { ApiError } from "./http";
import { recordSong, withSongAvailability } from "./songs";
import { READ_TTL_SEC, signedReads } from "./storage";

/** The pool or an open transaction (a transaction is a Sql too). */
type Db = ReturnType<typeof sql> | Tx;

export interface UnitRow {
  id: string;
  unit_no: number;
  batch_id: string;
  slug: string;
  status: UnitStatus;
  delivery_path: "A" | "B" | null;
  sender_email: string | null;
  code_redeemed_at: Date | null;
  claimed_at: Date | null;
  sealed_at: Date | null;
  revealed_at: Date | null;
  code_emailed_at: Date | null;
  code_emailed_to: string | null;
  content_updated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const UNIT_COLS = `id, unit_no, batch_id, slug, status, delivery_path, sender_email::text as sender_email,
  code_redeemed_at, claimed_at, sealed_at, revealed_at, code_emailed_at, code_emailed_to::text as code_emailed_to,
  content_updated_at, created_at, updated_at`;

export async function unitById(db: Db, id: string, lock = false): Promise<UnitRow | null> {
  const [row] = lock
    ? await db.unsafe<UnitRow[]>(`select ${UNIT_COLS} from units where id = $1 for update`, [id])
    : await db.unsafe<UnitRow[]>(`select ${UNIT_COLS} from units where id = $1`, [id]);
  return row ?? null;
}

export async function unitBySlug(db: Db, slug: string, lock = false): Promise<UnitRow | null> {
  const s = slug.toLowerCase();
  if (!/^[a-z2-7]{12}$/.test(s)) return null;
  const [row] = await db.unsafe<UnitRow[]>(`select ${UNIT_COLS} from units where slug = $1${lock ? " for update" : ""}`, [s]);
  return row ?? null;
}

export const unitNo = (n: number) => `S-${String(n).padStart(4, "0")}`;

// ─── Contents ────────────────────────────────────────────────────────────────

interface ContentRow {
  kind: StampKind;
  version: number;
  payload: StampContent;
  updated_at: Date;
}

export async function currentContents(db: Db, unitId: string): Promise<ContentMap> {
  const rows = await db<ContentRow[]>`select kind, version, payload, updated_at from current_contents where unit_id = ${unitId}`;
  const map: ContentMap = {};
  for (const r of rows) {
    (map as Record<string, ContentRecord>)[r.kind] = { unitId, kind: r.kind, content: r.payload, version: r.version, updatedAt: isoReq(r.updated_at) };
  }
  return map;
}

export const hasContent = (map: ContentMap) => STAMP_KINDS.some((k) => Boolean(map[k]));

/** claimed ⇄ filled follows content; sealed and revealed are sticky (the sender keeps editing). */
export function statusAfterEdit(current: UnitStatus, map: ContentMap): UnitStatus {
  const filled = hasContent(map);
  if (current === "claimed" && filled) return "filled";
  if (current === "filled" && !filled) return "claimed";
  return current;
}

/** Media ids referenced by a content payload. */
export function mediaIdsOf(c: StampContent): string[] {
  if (c.kind === "photos") return c.items.map((i) => i.mediaId);
  if (c.kind === "voice") return [c.mediaId];
  return [];
}

export type MediaUrls = Record<string, { url: string; expiresAt: string }>;

/** The wire key for a photo's thumbnail in `mediaUrls` (the main file is under the bare id). */
export const thumbUrlKey = (mediaId: string) => `${mediaId}:thumb`;

interface ServedMedia {
  urls: MediaUrls;
  /** Voice notes being served as the normalised AAC/m4a (their `mime` is reported as such). */
  audioIds: Set<string>;
}

/**
 * Signed read URLs for every ready media item the contents reference (wire-only `mediaUrls`):
 * the normalised file (display JPEG / AAC audio) under the media id, a photo's thumbnail under
 * `{id}:thumb`, and the verified original only until normalisation has run.
 */
async function servedMedia(db: Db, unitId: string, map: ContentMap): Promise<ServedMedia> {
  const ids = Object.values(map).flatMap((r) => (r ? mediaIdsOf(r.content as StampContent) : []));
  if (!ids.length) return { urls: {}, audioIds: new Set() };
  const rows = await db<{ id: string; kind: "photo" | "voice"; original_key: string; main_key: string | null; thumb_key: string | null }[]>`
    select m.id, m.kind, m.original_key,
      (select v.r2_key from media_variants v where v.media_id = m.id and v.variant in ('display', 'audio') order by v.version desc limit 1) as main_key,
      (select v.r2_key from media_variants v where v.media_id = m.id and v.variant = 'thumb' order by v.version desc limit 1) as thumb_key
    from media m where m.unit_id = ${unitId} and m.id = any(${ids}) and m.state = 'ready'`;
  const signed = await signedReads(rows.flatMap((r) => [r.main_key ?? r.original_key, ...(r.thumb_key ? [r.thumb_key] : [])]));
  const expiresAt = new Date(Date.now() + READ_TTL_SEC * 1000).toISOString();
  const urls: MediaUrls = {};
  const audioIds = new Set<string>();
  for (const r of rows) {
    const main = signed.get(r.main_key ?? r.original_key);
    if (main) urls[r.id] = { url: main, expiresAt };
    const thumb = r.thumb_key ? signed.get(r.thumb_key) : undefined;
    if (thumb) urls[thumbUrlKey(r.id)] = { url: thumb, expiresAt };
    if (r.kind === "voice" && r.main_key) audioIds.add(r.id);
  }
  return { urls, audioIds };
}

/** Contents as served: song availability from the catalog, and the voice note's real format. */
async function servedContents(db: Db, unitId: string): Promise<{ contents: ContentMap; mediaUrls: MediaUrls }> {
  const raw = await currentContents(db, unitId);
  const served = await servedMedia(db, unitId, raw);
  let contents = await withSongAvailability(db, raw);
  const voice = contents.voice;
  if (voice && served.audioIds.has(voice.content.mediaId) && voice.content.mime !== "audio/mp4") {
    contents = { ...contents, voice: { ...voice, content: { ...voice.content, mime: "audio/mp4" } } };
  }
  return { contents, mediaUrls: served.urls };
}

export async function senderEnvelope(db: Db, unit: UnitRow): Promise<SenderEnvelope & { mediaUrls: MediaUrls }> {
  const { contents, mediaUrls } = await servedContents(db, unit.id);
  return {
    unit: {
      id: unit.id,
      slug: unit.slug,
      status: unit.status,
      senderEmail: unit.sender_email,
      claimedAt: iso(unit.claimed_at),
      sealedAt: iso(unit.sealed_at),
      revealedAt: iso(unit.revealed_at),
      updatedAt: isoReq(unit.updated_at),
    },
    contents,
    mediaUrls,
  };
}

export async function recipientEnvelope(db: Db, unit: UnitRow): Promise<RecipientEnvelope & { mediaUrls: MediaUrls }> {
  const { contents, mediaUrls } = await servedContents(db, unit.id);
  return {
    slug: unit.slug,
    status: unit.status,
    sealedAt: iso(unit.sealed_at),
    revealedAt: iso(unit.revealed_at),
    contents,
    mediaUrls,
  };
}

// ─── Audit (append-only; never codes, tokens, links or message bodies) ──────

export async function audit(
  db: Db,
  e: { unitId: string | null; action: AuditAction; actor: "sender" | "recipient" | "admin" | "system"; adminId?: string | null; detail?: string },
): Promise<void> {
  const detail = e.detail ? { text: e.detail.slice(0, 500) } : {};
  await db`insert into audit_log (unit_id, action, actor, admin_id, detail)
           values (${e.unitId}, ${e.action}, ${e.actor}, ${e.adminId ?? null}, ${db.json(detail)})`;
}

// ─── Content validation (never trust the client) ────────────────────────────

const mediaId = z.string().regex(/^med_[a-z2-7]{26}$/);
const trimmed = (max: number) => z.string().max(max * 2).transform((s) => s.trim().slice(0, max));

const photos = z.object({
  kind: z.literal("photos"),
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        mediaId,
        width: z.number().int().min(1).max(20000),
        height: z.number().int().min(1).max(20000),
        caption: trimmed(site.limits.photoCaptionChars).optional(),
        alt: trimmed(200).optional(),
      }),
    )
    .min(1)
    .max(site.limits.photos),
});

const letter = z.object({
  kind: z.literal("letter"),
  to: trimmed(site.limits.letterNameChars),
  body: z.string().max(site.limits.letterChars + 200).refine((s) => s.trim().length > 0 && s.length <= site.limits.letterChars, "letter body"),
  signoff: trimmed(site.limits.letterSignoffChars),
  from: trimmed(site.limits.letterNameChars),
});

const voice = z.object({
  kind: z.literal("voice"),
  mediaId,
  durationSec: z.number().positive().max(site.limits.voiceSeconds + 0.5),
  mime: z.string().max(100),
  peaks: z.array(z.number().min(0).max(1)).max(256),
  source: z.enum(["recorded", "uploaded"]),
});

const song = z.object({
  kind: z.literal("song"),
  provider: z.enum(["spotify", "apple"]),
  url: z.string().max(512),
  trackId: z.string().max(40),
  albumId: z.string().regex(/^\d{1,20}$/).optional(),
  storefront: z.string().regex(/^[a-z]{2}$/).optional(),
  title: z.string().max(400),
  artist: z.string().max(400),
  artworkUrl: z.string().max(500).optional(),
  durationMs: z.number().int().positive().max(24 * 3600_000).optional(),
  embedUrl: z.string().max(600),
  unavailable: z.boolean().optional(),
});

const schemas = { photos, letter, voice, song } as const;

/** Validate a stamp payload; songs get their links re-derived server-side (ARCHITECTURE.md §6.2). */
export function parseContent(kind: StampKind, raw: unknown): StampContent {
  const parsed = schemas[kind].parse(raw) as StampContent;
  if (parsed.kind !== "song") return parsed;
  if (parsed.provider === "spotify") {
    if (!/^[A-Za-z0-9]{22}$/.test(parsed.trackId)) throw new ApiError("unsupported_link", "spotify track id");
    return {
      kind: "song",
      provider: "spotify",
      trackId: parsed.trackId,
      url: spotifyTrackUrl(parsed.trackId),
      embedUrl: spotifyEmbedUrl(parsed.trackId),
      title: cleanText(parsed.title),
      artist: cleanText(parsed.artist),
      artworkUrl: isAllowedArtworkUrl(parsed.artworkUrl) ? parsed.artworkUrl : undefined,
      durationMs: parsed.durationMs,
    };
  }
  const link = parseSongLink(parsed.url);
  if (link.type !== "track" || link.provider !== "apple" || link.trackId !== parsed.trackId) throw new ApiError("unsupported_link", "apple link");
  const canonical = canonicalAppleUrl(link.url);
  return {
    kind: "song",
    provider: "apple",
    trackId: link.trackId,
    albumId: link.albumId ?? parsed.albumId,
    storefront: link.storefront ?? parsed.storefront,
    url: canonical.toString(),
    embedUrl: appleEmbedUrl(canonical),
    title: cleanText(parsed.title),
    artist: cleanText(parsed.artist),
    artworkUrl: isAllowedArtworkUrl(parsed.artworkUrl) ? parsed.artworkUrl : undefined,
    durationMs: parsed.durationMs,
  };
}

/** Every referenced media item must be this unit's, of the right kind, uploaded and verified. */
export async function assertMediaUsable(db: Db, unitId: string, content: StampContent): Promise<void> {
  const ids = mediaIdsOf(content);
  if (!ids.length) return;
  const kind = content.kind === "photos" ? "photo" : "voice";
  const rows = await db<{ id: string }[]>`
    select id from media where unit_id = ${unitId} and kind = ${kind} and state = 'ready' and id = any(${ids})`;
  if (rows.length !== new Set(ids).size) throw new ApiError("upload_failed", "media not ready or not this envelope's");
}

/**
 * Save a stamp as a new version (supersede the head, insert version+1), link its media and
 * recompute the unit status, in the caller's transaction. Returns the new ContentRecord.
 */
export async function saveContent(t: Tx, unit: UnitRow, content: StampContent, by: "sender" | "admin"): Promise<ContentRecord> {
  const [head] = await t<{ id: string; version: number }[]>`
    update contents set superseded_at = now()
    where unit_id = ${unit.id} and kind = ${content.kind} and superseded_at is null
    returning id, version`;
  const version = (head?.version ?? 0) + 1;
  const [row] = await t<{ id: string; created_at: Date }[]>`
    insert into contents (unit_id, kind, version, payload, saved_by)
    values (${unit.id}, ${content.kind}, ${version}, ${t.json(content as unknown as postgres.JSONValue)}, ${by})
    returning id, created_at`;
  const ids = [...new Set(mediaIdsOf(content))];
  for (const id of ids) await t`insert into content_media (content_id, media_id) values (${row.id}, ${id})`;
  if (content.kind === "song") await recordSong(t, content);
  const map = await currentContents(t, unit.id);
  await t`update units set status = ${statusAfterEdit(unit.status, map)}, content_updated_at = now() where id = ${unit.id}`;
  return { unitId: unit.id, kind: content.kind, content, version, updatedAt: isoReq(row.created_at) } as ContentRecord;
}

/** Mark a stamp's head removed (history stays) and recompute the status. */
export async function removeContent(t: Tx, unit: UnitRow, kind: StampKind, by: "sender" | "admin"): Promise<boolean> {
  const rows = await t`
    update contents set removed_at = now(), removed_by = ${by}
    where unit_id = ${unit.id} and kind = ${kind} and superseded_at is null and removed_at is null
    returning id`;
  const map = await currentContents(t, unit.id);
  await t`update units set status = ${statusAfterEdit(unit.status, map)}, content_updated_at = now() where id = ${unit.id}`;
  return rows.length > 0;
}

// ─── History and restore (CLIENT_GUIDE §8: replaced or removed content can be recovered) ──

interface VersionRow {
  kind: StampKind;
  version: number;
  payload: StampContent;
  saved_by: "sender" | "admin";
  created_at: Date;
  superseded_at: Date | null;
  removed_at: Date | null;
  purged: boolean;
}

/** Every saved version of every stamp, newest first (at most `limit`). */
export async function contentHistory(db: Db, unitId: string, limit = 100): Promise<ContentVersion[]> {
  const rows = await db<VersionRow[]>`
    select c.kind, c.version, c.payload, c.saved_by, c.created_at, c.superseded_at, c.removed_at,
           exists (
             select 1 from content_media cm join media m on m.id = cm.media_id
             where cm.content_id = c.id and (m.purged_at is not null or m.state not in ('ready', 'removed'))
           ) as purged
    from contents c where c.unit_id = ${unitId}
    order by c.created_at desc, c.version desc limit ${limit}`;
  return rows.map((r) => ({
    kind: r.kind,
    version: r.version,
    savedBy: r.saved_by,
    savedAt: isoReq(r.created_at),
    supersededAt: iso(r.superseded_at),
    removedAt: iso(r.removed_at),
    current: r.superseded_at === null && r.removed_at === null,
    summary: summarise(r.payload),
    restorable: !r.purged,
  }));
}

/**
 * Make version `version` of a stamp current again, as a new version saved by the admin. Media it
 * references that was soft-deleted is brought back; media already purged (after the 90-day
 * window) can't be, so such a version is refused. Caller holds the unit row lock.
 */
export async function restoreVersion(t: Tx, unit: UnitRow, kind: StampKind, version: number): Promise<ContentRecord> {
  const [old] = await t<{ id: string; payload: StampContent; superseded_at: Date | null; removed_at: Date | null }[]>`
    select id, payload, superseded_at, removed_at from contents where unit_id = ${unit.id} and kind = ${kind} and version = ${version}`;
  if (!old) throw new ApiError("not_found", "no such version");
  if (old.superseded_at === null && old.removed_at === null) throw new ApiError("invalid_input", "that version is already the current one");
  const ids = mediaIdsOf(old.payload);
  if (ids.length) {
    const gone = await t`select id from media where id = any(${ids}) and (purged_at is not null or state not in ('ready', 'removed'))`;
    if (gone.length) throw new ApiError("invalid_input", "its files were deleted for good after the 90-day recovery window");
    await t`update media set state = 'ready', removed_at = null, removed_by = null, purge_after = null
            where id = any(${ids}) and state = 'removed'`;
  }
  return saveContent(t, unit, old.payload, "admin");
}
