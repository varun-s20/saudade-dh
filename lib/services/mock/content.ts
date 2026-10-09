import { parseSongLink } from "@/lib/parsing/songs";
import {
  isSongContent,
  rejectParsed,
  resolveTrackViaPublicApis,
  SONG_LINK_MAX_CHARS,
} from "@/lib/services/api/song-providers";
import type { ContentMap, ContentRecord, ContentService, StampKind } from "@/lib/services/types";
import { isForced } from "@/lib/state/demo";
import { appendAudit, db, fail, latency, nowIso, ok, patchUnit, ready, statusAfterEdit, unitByToken, update } from "./runtime";
import { toSenderEnvelope } from "./units";

export const contentService: ContentService = {
  async getSenderEnvelope(token) {
    await ready();
    await latency(0.6);
    if (isForced("network")) return fail("network");
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");
    return ok(toSenderEnvelope(unit.id));
  },

  /**
   * REAL, not simulated: calls the server resolver (app/api/song/resolve), which follows short
   * links and reads the artist from the Spotify track page. If the route is unreachable (static
   * export, offline dev server), falls back to the CORS-enabled public APIs in the browser
   * (Spotify oEmbed: no artist; iTunes Lookup). Short links need the server.
   */
  async resolveSong(link) {
    if (isForced("network")) {
      await latency(0.5);
      return fail("network", { detail: "forced by the Demo Panel" });
    }

    // Cheap local checks first: no round trip for empty, foreign, album or playlist links.
    const trimmed = link.trim();
    if (trimmed.length > SONG_LINK_MAX_CHARS) return fail("unsupported_link", { detail: "link too long" });
    const parsed = parseSongLink(trimmed);
    if (parsed.type !== "track" && parsed.type !== "short") {
      const r = rejectParsed(parsed);
      return r.ok ? ok(r.song) : fail(r.code, { detail: r.detail });
    }

    let res: Response | null = null;
    try {
      res = await fetch("/api/song/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ link: trimmed }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      res = null; // route unreachable → browser fallback below
    }

    if (res) {
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && isSongContent(body)) return ok(body);
      const err = typeof body === "object" && body !== null ? (body as { code?: unknown; detail?: unknown; retryAfterSec?: unknown }) : null;
      const detail = typeof err?.detail === "string" ? err.detail : undefined;
      if (err?.code === "unsupported_link" || err?.code === "not_found") return fail(err.code, { detail });
      if (err?.code === "network") return fail("network", { detail });
      // ContentService.resolveSong documents unsupported_link | not_found | network only.
      if (err?.code === "rate_limited") {
        return fail("network", { detail: "rate_limited", retryAfterSec: typeof err.retryAfterSec === "number" ? err.retryAfterSec : undefined });
      }
      // Anything else (404 HTML from a build without the route, 5xx page): treat as unreachable.
    }

    if (parsed.type === "short") return fail("network", { detail: "short links need the server resolver" });
    const r = await resolveTrackViaPublicApis(parsed);
    return r.ok ? ok(r.song) : fail(r.code, { detail: `${r.detail} (browser fallback)` });
  },

  async save(token, content) {
    await ready();
    await latency();
    if (isForced("network")) return fail("network");
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");

    const kind = content.kind;
    const prev = db().contents[unit.id]?.[kind];
    const record = {
      unitId: unit.id,
      kind,
      content,
      version: (prev?.version ?? 0) + 1,
      updatedAt: nowIso(),
    } as ContentRecord<typeof kind>;
    const nextMap: ContentMap = { ...(db().contents[unit.id] ?? {}), [kind]: record };
    update((s) => ({ contents: { ...s.contents, [unit.id]: nextMap } }));
    patchUnit(unit.id, { status: statusAfterEdit(unit.status, nextMap) });
    appendAudit({ unitId: unit.id, action: "content.saved", actor: "sender", detail: `${kind} v${record.version}` });
    return ok(record);
  },

  async remove(token, kind: StampKind) {
    await ready();
    await latency();
    if (isForced("network")) return fail("network");
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");
    const nextMap: ContentMap = { ...(db().contents[unit.id] ?? {}) };
    delete nextMap[kind];
    update((s) => ({ contents: { ...s.contents, [unit.id]: nextMap } }));
    patchUnit(unit.id, { status: statusAfterEdit(unit.status, nextMap) });
    appendAudit({ unitId: unit.id, action: "content.removed", actor: "sender", detail: kind });
    return ok(toSenderEnvelope(unit.id));
  },
};
