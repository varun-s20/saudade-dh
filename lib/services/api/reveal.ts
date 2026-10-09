/**
 * RevealService over HTTP (ARCHITECTURE.md §8 first-open integrity).
 *
 * GET /api/t/{slug} has no side effects. The reveal is a separate POST, sent by the recipient
 * route only after "Tap to open" + the choreography (or Skip). If this device holds the sender
 * token for the slug (the sender testing their own ceramic), the token is attached and the server
 * records `sender_excluded` instead of consuming the first open.
 */
import type { RecipientEnvelope, RevealService } from "@/lib/services/types";
import { idempotencyKey, ok, path, request, senderTokenForSlug } from "./http";
import { takeMediaUrls, type WithMediaUrls } from "./media";

export const apiRevealService: RevealService = {
  async getEnvelope(slug) {
    const res = await request<WithMediaUrls<RecipientEnvelope>>({ path: path`/api/t/${slug.toLowerCase()}` });
    return res.ok ? ok(takeMediaUrls(res.data)) : res;
  },

  async markRevealed(slug, info) {
    const token = senderTokenForSlug(slug.toLowerCase());
    return request<void>({
      method: "POST",
      path: path`/api/t/${slug.toLowerCase()}/reveal`,
      body: { skipped: info.skipped, reducedMotion: info.reducedMotion },
      headers: { "idempotency-key": idempotencyKey() },
      auth: token ? { sender: token } : "none",
      expect: "empty",
    });
  },
};
