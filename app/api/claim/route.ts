/**
 * POST /api/claim  { code, turnstileToken? }  →  200 ClaimResult { token, slug, senderUrl }
 * 422 invalid_code · 409 already_claimed · 429 rate_limited (+ Retry-After) · 403 challenge_required
 *
 * Only failures count towards the limits (ARCHITECTURE.md §9.2): 10 / 15 min and 30 / day per IP,
 * plus a global breaker at 300 failures / hour across everyone. Unknown and malformed codes take
 * the same path (one HMAC + one index probe), so timing doesn't reveal which codes exist.
 *
 * The breaker: with Turnstile configured (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY),
 * tripping it turns on a bot check for every claim for six hours (logged once as
 * system.breaker_tripped), so real buyers keep claiming during an attack. Without Turnstile,
 * claims are refused until the hour's failures reset.
 *
 * Codes from a voided batch (its CSV was lost before encoding) are unknown codes.
 */
import { senderPath, site } from "@/config/site";
import { normaliseCode } from "@/lib/parsing/codes";
import { codeHash, ipKey } from "@/lib/server/crypto";
import { sql, tx } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { ApiError, body, clientIp, hit, json, peek, route } from "@/lib/server/http";
import { issueToken } from "@/lib/server/tokens";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { z } from "zod";

const Body = z.object({ code: z.string().max(32), turnstileToken: z.string().max(4096).optional() });

const LIMITS: [rule: string, windowSec: number, max: number][] = [
  ["claim_fail_15m", 900, 10],
  ["claim_fail_day", 86_400, 30],
];
const GLOBAL: [string, number, number] = ["claim_fail_global", 3600, 300];
const BREAKER_KEY = "claim_breaker:all:until";
const BREAKER_SEC = 6 * 3600;

/** Whether the six-hour bot-check period is running. */
async function breakerArmed(): Promise<boolean> {
  const [m] = await sql()`select 1 from rate_limit_buckets where key = ${BREAKER_KEY} and expires_at > now()`;
  return Boolean(m);
}

/** (Re)start the six-hour period; the first trip of a period is logged. */
async function armBreaker(failures: number): Promise<void> {
  const fresh = await sql()`
    insert into rate_limit_buckets (key, window_start, window_seconds, count, expires_at)
    values (${BREAKER_KEY}, now(), ${BREAKER_SEC}, 1, now() + make_interval(secs => ${BREAKER_SEC}))
    on conflict (key) do update
      set count = case when rate_limit_buckets.expires_at <= now() then 1 else rate_limit_buckets.count + 1 end,
          window_start = case when rate_limit_buckets.expires_at <= now() then now() else rate_limit_buckets.window_start end,
          expires_at = now() + make_interval(secs => ${BREAKER_SEC})
    returning count`;
  if (fresh[0]?.count === 1) {
    await audit(sql(), { unitId: null, action: "system.breaker_tripped", actor: "system", detail: `${failures} failed claims in an hour: bot check on for 6 hours` });
  }
}

export const POST = route(async (req) => {
  const { code, turnstileToken } = await body(req, Body, 8192);
  const rawIp = clientIp(req);
  const ip = ipKey(rawIp);

  for (const [rule, win, max] of LIMITS) {
    const p = await peek(rule, ip, win);
    if (p.count >= max) throw new ApiError("rate_limited", rule, p.retryAfterSec);
  }

  const g = await peek(GLOBAL[0], "all", GLOBAL[1]);
  const overBudget = g.count >= GLOBAL[2];
  const turnstileSecret = site.turnstileSiteKey ? env.turnstileSecret() : null;
  if (!turnstileSecret) {
    if (overBudget) throw new ApiError("rate_limited", "breaker", g.retryAfterSec);
  } else if (overBudget || (await breakerArmed())) {
    if (overBudget) await armBreaker(g.count);
    if (!turnstileToken) throw new ApiError("challenge_required", "breaker", undefined, 403);
    if (!(await verifyTurnstile(turnstileSecret, turnstileToken, rawIp))) throw new ApiError("challenge_required", "challenge failed", undefined, 403);
  }

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
      select u.id, u.slug, u.status, u.code_redeemed_at
      from units u join batches b on b.id = u.batch_id
      where u.code_hash = ${hash} and b.status <> 'void'
      for update of u`;
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
