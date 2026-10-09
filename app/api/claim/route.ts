/**
 * POST /api/claim  { code }  →  200 ClaimResult { token, slug, senderUrl }
 * 422 invalid_code · 409 already_claimed · 429 rate_limited (+ Retry-After)
 *
 * Only failures count towards the limits (ARCHITECTURE.md §9.2): 10 / 15 min and 30 / day per IP,
 * plus a global breaker at 300 failures / hour across everyone. Unknown and malformed codes take
 * the same path (one HMAC + one index probe), so timing doesn't reveal which codes exist.
 */
import { senderPath } from "@/config/site";
import { normaliseCode } from "@/lib/parsing/codes";
import { ipKey, codeHash } from "@/lib/server/crypto";
import { tx } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { ApiError, body, clientIp, hit, json, peek, route } from "@/lib/server/http";
import { issueToken } from "@/lib/server/tokens";
import { z } from "zod";

const Body = z.object({ code: z.string().max(32), turnstileToken: z.string().max(4096).optional() });

const LIMITS: [rule: string, windowSec: number, max: number][] = [
  ["claim_fail_15m", 900, 10],
  ["claim_fail_day", 86_400, 30],
];
const GLOBAL: [string, number, number] = ["claim_fail_global", 3600, 300];

export const POST = route(async (req) => {
  const { code } = await body(req, Body, 2048);
  const ip = ipKey(clientIp(req));

  for (const [rule, win, max] of LIMITS) {
    const p = await peek(rule, ip, win);
    if (p.count >= max) throw new ApiError("rate_limited", rule, p.retryAfterSec);
  }
  const g = await peek(GLOBAL[0], "all", GLOBAL[1]);
  if (g.count >= GLOBAL[2]) throw new ApiError("rate_limited", "breaker", g.retryAfterSec);

  const failed = async (codeErr: "invalid_code" | "already_claimed"): Promise<never> => {
    for (const [rule, win] of LIMITS) await hit(rule, ip, win);
    await hit(GLOBAL[0], "all", GLOBAL[1]);
    throw new ApiError(codeErr);
  };

  const norm = normaliseCode(code);
  if (!norm) return failed("invalid_code");
  const hash = codeHash(norm);

  const result = await tx(async (t) => {
    const [u] = await t<{ id: string; slug: string; status: string; code_redeemed_at: Date | null }[]>`
      select id, slug, status, code_redeemed_at from units where code_hash = ${hash} for update`;
    if (!u) return { ok: false as const, err: "invalid_code" as const };
    if (u.code_redeemed_at) return { ok: false as const, err: "already_claimed" as const };
    // A code reissued by the admin re-claims the same envelope: content, seal and reveal are
    // kept; only a new private link is issued (the old ones were revoked at reset).
    const fresh = u.status === "unassigned" || u.status === "assigned";
    await t`update units set code_redeemed_at = now(), claimed_at = coalesce(claimed_at, now()),
              status = ${fresh ? "claimed" : u.status}, delivery_path = coalesce(delivery_path, 'A')
            where id = ${u.id}`;
    const token = await issueToken(t, u.id, "claim");
    await audit(t, { unitId: u.id, action: "unit.claimed", actor: "sender", detail: fresh ? undefined : "re-claimed with a reissued code" });
    await audit(t, { unitId: u.id, action: "unit.token_issued", actor: "system" });
    return { ok: true as const, token, slug: u.slug };
  });

  if (!result.ok) return failed(result.err);
  return json({ token: result.token, slug: result.slug, senderUrl: senderPath(result.token) });
});
