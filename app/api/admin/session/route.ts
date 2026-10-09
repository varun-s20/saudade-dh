/**
 * POST   /api/admin/session { email, password } → 200 AdminSession + Set-Cookie
 * GET    /api/admin/session                     → 200 AdminSession · 401
 * DELETE /api/admin/session                     → 204 (cookie cleared, session revoked)
 *
 * 5 wrong passwords lock the account for 15 minutes (401 detail "locked"); 20 failures / day / IP
 * → 429. Every sign-in, failure and sign-out is in the audit log. [PROPOSED AQ5] TOTP is a Phase 3
 * addition on top of this (columns already exist).
 */
import { adminFromRequest, cookieName, requireAdmin, SESSION_DAYS, sessionCookie } from "@/lib/server/admin-auth";
import { hashPassword, ipHash, ipKey, newSessionId, sha256, verifyPassword } from "@/lib/server/crypto";
import { isoReq, sql } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { ApiError, body, clientIp, hit, json, noContent, peek, route } from "@/lib/server/http";
import { z } from "zod";

const Body = z.object({ email: z.string().max(254), password: z.string().min(1).max(256), otp: z.string().max(12).optional() });

/** Verified against when the email is unknown, so timing doesn't reveal which emails are admins. */
let dummyHash: Promise<string> | null = null;

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const p = await peek("admin_fail_day", ipKey(ip), 86_400);
  if (p.count >= 20) throw new ApiError("rate_limited", "too many failed sign-ins", p.retryAfterSec);
  const { email, password } = await body(req, Body, 2048);

  const [admin] = await sql()<{ id: string; email: string; password_hash: string; locked_until: Date | null; failed_sign_ins: number }[]>`
    select id, email::text as email, password_hash, locked_until, failed_sign_ins
    from admin_users where email = ${email.trim().toLowerCase()} and disabled_at is null`;

  if (admin?.locked_until && admin.locked_until > new Date()) throw new ApiError("unauthorized", "locked");

  const good = admin ? await verifyPassword(password, admin.password_hash) : await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
  if (!admin || !good) {
    await hit("admin_fail_day", ipKey(ip), 86_400);
    if (admin) {
      const fails = admin.failed_sign_ins + 1;
      await sql()`update admin_users set failed_sign_ins = ${fails >= 5 ? 0 : fails},
                    locked_until = ${fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null} where id = ${admin.id}`;
    }
    await audit(sql(), { unitId: null, action: "admin.sign_in_failed", actor: "admin", adminId: admin?.id ?? null });
    throw new ApiError("unauthorized", "invalid_credentials");
  }

  const sid = newSessionId();
  const [s] = await sql()<{ created_at: Date }[]>`
    insert into admin_sessions (id_hash, admin_id, mfa_verified, expires_at, user_agent, ip_hash)
    values (${sha256(sid)}, ${admin.id}, false, now() + make_interval(days => ${SESSION_DAYS}),
            ${(req.headers.get("user-agent") ?? "").slice(0, 400)}, ${ipHash(ip)})
    returning created_at`;
  await sql()`update admin_users set failed_sign_ins = 0, locked_until = null, last_sign_in_at = now() where id = ${admin.id}`;
  await audit(sql(), { unitId: null, action: "admin.signed_in", actor: "admin", adminId: admin.id, detail: admin.email });
  return json({ email: admin.email, signedInAt: isoReq(s.created_at) }, 200, { "set-cookie": sessionCookie(req, sid, SESSION_DAYS * 86_400) });
});

export const GET = route(async (req) => {
  const ctx = await adminFromRequest(req);
  if (!ctx) throw new ApiError("unauthorized", "not signed in");
  return json(ctx.session);
});

export const DELETE = route(async (req) => {
  const raw = req.cookies.get(cookieName(req))?.value;
  if (raw) {
    const ctx = await requireAdmin(req).catch(() => null);
    await sql()`update admin_sessions set revoked_at = now() where id_hash = ${sha256(raw)} and revoked_at is null`;
    if (ctx) await audit(sql(), { unitId: null, action: "admin.signed_out", actor: "admin", adminId: ctx.adminId });
  }
  return noContent({ "set-cookie": sessionCookie(req, "", 0) });
});
