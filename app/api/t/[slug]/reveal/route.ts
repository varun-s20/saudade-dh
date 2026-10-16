/**
 * POST /api/t/{slug}/reveal { skipped, reducedMotion } + Idempotency-Key → 204, always.
 *
 * The first open is recorded ONLY here, after "Tap to open" and the choreography (or Skip), never
 * on a page load (ARCHITECTURE.md §8). The unit row is locked so two phones tapping at once give
 * one `revealed` and one `duplicate`. Nothing is consumed when the request carries this unit's
 * sender token (the sender testing their own ceramic: AQ8), an admin session (packing checks:
 * every boxed ceramic is tapped before the box is closed, ARCHITECTURE.md §17), or comes from a
 * link-preview bot.
 */
import { site } from "@/config/site";
import { adminFromRequest } from "@/lib/server/admin-auth";
import { ipHash, ipKey } from "@/lib/server/crypto";
import { tx } from "@/lib/server/db";
import { audit, unitBySlug } from "@/lib/server/envelopes";
import { ApiError, body, clientIp, limit, noContent, route, senderUnitId } from "@/lib/server/http";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ slug: string }> };

const Body = z.object({ skipped: z.boolean(), reducedMotion: z.boolean() });

/** Backstop only; the guard is the human gesture. */
const BOT_UA =
  /facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|Discordbot|WhatsApp\/|GoogleMessages|LinkedInBot|SkypeUriPreview|Pinterestbot|redditbot|Applebot|Googlebot|bingbot|Embedly|Iframely/i;

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { slug } = await ctx.params;
  const ip = clientIp(req);
  await limit("reveal", ipKey(ip), 60, 20);
  const info = await body(req, Body, 1024);
  const key = req.headers.get("idempotency-key")?.slice(0, 64) || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  const senderOf = await senderUnitId(req);
  // The admin cookie is SameSite=Strict, so it only arrives from the site itself.
  const admin = await adminFromRequest(req).catch(() => null);

  await tx(async (t) => {
    const unit = await unitBySlug(t, slug, true);
    if (!unit) throw new ApiError("not_found");
    const bot = BOT_UA.test(ua);
    const revealable = unit.status === "sealed" || (!site.requireSealBeforeReveal && unit.status === "filled");

    let outcome: "revealed" | "duplicate" | "not_revealable" | "sender_excluded" | "admin_excluded" | "bot_ignored";
    if (senderOf === unit.id) outcome = "sender_excluded";
    else if (admin) outcome = "admin_excluded";
    else if (bot) outcome = "bot_ignored";
    else if (unit.revealed_at) outcome = "duplicate";
    else if (revealable) outcome = "revealed";
    else outcome = "not_revealable";

    const inserted = await t`
      insert into reveal_events (unit_id, outcome, skipped, reduced_motion, user_agent, ua_flagged_bot, ip_hash, idempotency_key)
      values (${unit.id}, ${outcome}, ${info.skipped}, ${info.reducedMotion}, ${ua}, ${bot}, ${ipHash(ip)}, ${key})
      on conflict (unit_id, idempotency_key) do nothing
      returning id`;
    if (!inserted.length) return; // a retried request: already handled

    if (outcome === "revealed") {
      await t`update units set status = 'revealed', revealed_at = now() where id = ${unit.id}`;
      await audit(t, { unitId: unit.id, action: "unit.revealed", actor: "recipient", detail: info.skipped ? "skipped choreography" : "watched choreography" });
    } else if (outcome === "sender_excluded") {
      await audit(t, { unitId: unit.id, action: "unit.reveal_excluded", actor: "sender", detail: "sender's own device" });
    } else if (outcome === "admin_excluded" && admin) {
      await audit(t, { unitId: unit.id, action: "unit.reveal_excluded", actor: "admin", adminId: admin.adminId, detail: "admin check (not counted)" });
    }
  });
  return noContent();
});
