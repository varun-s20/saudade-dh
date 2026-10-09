/**
 * GET /api/t/{slug} → 200 RecipientEnvelope + mediaUrls. No side effects, ever: link-preview
 * bots fetch it freely (ARCHITECTURE.md §8). 404 unknown slug; 30 not-founds / 10 min / IP → 429
 * (an enumeration tripwire; 60-bit slugs can't be guessed anyway).
 */
import { ipKey } from "@/lib/server/crypto";
import { sql } from "@/lib/server/db";
import { recipientEnvelope, unitBySlug } from "@/lib/server/envelopes";
import { ApiError, clientIp, hit, json, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>(async (req: NextRequest, ctx) => {
  const { slug } = await ctx.params;
  const unit = await unitBySlug(sql(), slug);
  if (!unit) {
    const n = await hit("t_notfound", ipKey(clientIp(req)), 600);
    if (n.count > 30) throw new ApiError("rate_limited", "not-found tripwire", n.retryAfterSec);
    throw new ApiError("not_found");
  }
  return json(await recipientEnvelope(sql(), unit));
});
