/** ContentService over HTTP (ARCHITECTURE.md §6.2). */
import type { ContentOf, ContentRecord, ContentService, SenderEnvelope, SongContent, StampKind } from "@/lib/services/types";
import { fail, ok, path, rememberSenderUnit, request } from "./http";
import { takeMediaUrls, type WithMediaUrls } from "./media";
import { isSongContent } from "./song-providers";

export const apiContentService: ContentService = {
  async getSenderEnvelope(token) {
    const res = await request<WithMediaUrls<SenderEnvelope>>({ path: "/api/sender/envelope", auth: { sender: token } });
    if (!res.ok) return res;
    const env = takeMediaUrls(res.data);
    rememberSenderUnit(env.unit.slug, token);
    return ok(env);
  },

  async resolveSong(link) {
    const res = await request<SongContent>({ method: "POST", path: "/api/song/resolve", body: { link }, timeoutMs: 20_000 });
    if (!res.ok) {
      // The contract documents unsupported_link | not_found | network only.
      const { code, detail, retryAfterSec } = res.error;
      if (code === "unsupported_link" || code === "not_found" || code === "network") return res;
      if (code === "too_large") return fail("unsupported_link", { detail });
      return fail("network", { detail: detail ?? code, retryAfterSec });
    }
    return isSongContent(res.data) ? res : fail("network", { detail: "malformed song response" });
  },

  /** Last write wins per stamp; the server bumps `version` and keeps the previous row (history). */
  async save<K extends StampKind>(token: string, content: ContentOf<K>) {
    return request<ContentRecord<K>>({
      method: "PUT",
      path: path`/api/sender/contents/${content.kind}`,
      auth: { sender: token },
      body: content,
    });
  },

  async remove(token, kind) {
    const res = await request<WithMediaUrls<SenderEnvelope>>({
      method: "DELETE",
      path: path`/api/sender/contents/${kind}`,
      auth: { sender: token },
    });
    return res.ok ? ok(takeMediaUrls(res.data)) : res;
  },
};
