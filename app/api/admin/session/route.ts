/**
 * POST   /api/admin/session { email, password, otp? } → 200 AdminSession + Set-Cookie
 * GET    /api/admin/session                           → 200 AdminSession · 401
 * DELETE /api/admin/session                           → 204 (cookie cleared, session revoked)
 *
 * 5 wrong passwords (or one-time codes) lock the account for 15 minutes (401 detail "locked");
 * 20 failures / day / IP → 429. Every sign-in, failure and sign-out is in the audit log.
 *
 * Two-factor (AQ5, on when TOTP_ENC_KEY is set): an admin with an authenticator must send `otp`
 * (6 digits, or one of their recovery codes); without it a right password gets 401
 * "otp_required" and nothing else. An admin without one yet signs in to an `enrol` session that
 * can only set one up (app/api/admin/2fa).
 */
import { adminFromRequest, cookieName, requireAdmin, SESSION_DAYS, sessionCookie, twoFactorRequired } from "@/lib/server/admin-auth";
import { hashPassword, ipHash, ipKey, newSessionId, sha256, verifyPassword } from "@/lib/server/crypto";
import { isoReq, sql } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { ApiError, body, clientIp, hit, json, noContent, peek, route } from "@/lib/server/http";
import { looksLikeRecoveryCode, openSecret, recoveryHash, verifyTotp } from "@/lib/server/totp";
import type { AdminSession } from "@/lib/services/types";
import { z } from "zod";

const Body = z.object({ email: z.string().max(254), password: z.string().min(1).max(256), otp: z.string().max(32).optional() });

/** Verified against when the email is unknown, so timing doesn't reveal which emails are admins. */
let dummyHash: Promise<string> | null = null;

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  locked_until: Date | null;
  failed_sign_ins: number;
  totp_secret_enc: Buffer | null;
  totp_last_used_step: string | number | null;
}

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const p = await peek("admin_fail_day", ipKey(ip), 86_400);
  if (p.count >= 20) throw new ApiError("rate_limited", "too many failed sign-ins", p.retryAfterSec);
  const { email, password, otp } = await body(req, Body, 2048);

  const [admin] = await sql()<AdminRow[]>`
    select id, email::text as email, password_hash, locked_until, failed_sign_ins, totp_secret_enc, totp_last_used_step
    from admin_users where email = ${email.trim().toLowerCase()} and disabled_at is null`;

  if (admin?.locked_until && admin.locked_until > new Date()) throw new ApiError("unauthorized", "locked");

  /** One strike against the account (5 = locked 15 min) and the IP; logged. */
  const strike = async (reason: string): Promise<never> => {
    await hit("admin_fail_day", ipKey(ip), 86_400);
    if (admin) {
      const fails = admin.failed_sign_ins + 1;
      await sql()`update admin_users set failed_sign_ins = ${fails >= 5 ? 0 : fails},
                    locked_until = ${fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null} where id = ${admin.id}`;
    }
    await audit(sql(), { unitId: null, action: "admin.sign_in_failed", actor: "admin", adminId: admin?.id ?? null, detail: reason });
    throw new ApiError("unauthorized", reason === "wrong one-time code" ? "invalid_otp" : "invalid_credentials");
  };

  const good = admin ? await verifyPassword(password, admin.password_hash) : await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
  if (!admin || !good) return strike("wrong email or password");

  // ── Second factor ──
  const key = env.totpKey();
  let mfaVerified = false;
  if (key && admin.totp_secret_enc) {
    if (!otp?.trim()) throw new ApiError("unauthorized", "otp_required");
    const secret = openSecret(key, admin.id, admin.totp_secret_enc);
    if (!secret) throw new Error("TOTP secret could not be decrypted: TOTP_ENC_KEY changed? Reset this admin's 2FA (scripts/admin-user.mjs).");
    if (looksLikeRecoveryCode(otp)) {
      const used = await sql()`
        update admin_users set recovery_code_hashes = array_remove(recovery_code_hashes, ${recoveryHash(otp)}::bytea)
        where id = ${admin.id} and ${recoveryHash(otp)}::bytea = any(recovery_code_hashes)
        returning id`;
      if (!used.length) return strike("wrong one-time code");
      await audit(sql(), { unitId: null, action: "admin.recovery_code_used", actor: "admin", adminId: admin.id });
    } else {
      const last = admin.totp_last_used_step === null ? null : Number(admin.totp_last_used_step);
      const step = verifyTotp(secret, otp, Date.now(), last);
      // The conditional update makes a replay lose even if two sign-ins race with the same code.
      const claimed = step === null ? [] : await sql()`
        update admin_users set totp_last_used_step = ${step}
        where id = ${admin.id} and (totp_last_used_step is null or totp_last_used_step < ${step})
        returning id`;
      if (!claimed.length) return strike("wrong one-time code");
    }
    mfaVerified = true;
  }

  const sid = newSessionId();
  const [s] = await sql()<{ created_at: Date }[]>`
    insert into admin_sessions (id_hash, admin_id, mfa_verified, expires_at, user_agent, ip_hash)
    values (${sha256(sid)}, ${admin.id}, ${mfaVerified}, now() + make_interval(days => ${SESSION_DAYS}),
            ${(req.headers.get("user-agent") ?? "").slice(0, 400)}, ${ipHash(ip)})
    returning created_at`;
  await sql()`update admin_users set failed_sign_ins = 0, locked_until = null, last_sign_in_at = now() where id = ${admin.id}`;
  await audit(sql(), { unitId: null, action: "admin.signed_in", actor: "admin", adminId: admin.id, detail: mfaVerified ? `${admin.email} (two-factor)` : admin.email });

  const session: AdminSession = {
    email: admin.email,
    signedInAt: isoReq(s.created_at),
    twoFactor: !twoFactorRequired() ? "off" : mfaVerified ? "verified" : "enrol",
  };
  return json(session, 200, { "set-cookie": sessionCookie(req, sid, SESSION_DAYS * 86_400) });
});

export const GET = route(async (req) => {
  const ctx = await adminFromRequest(req);
  if (!ctx) throw new ApiError("unauthorized", "not signed in");
  return json(ctx.session);
});

export const DELETE = route(async (req) => {
  const raw = req.cookies.get(cookieName(req))?.value;
  if (raw) {
    const ctx = await requireAdmin(req, { allowEnrol: true }).catch(() => null);
    await sql()`update admin_sessions set revoked_at = now() where id_hash = ${sha256(raw)} and revoked_at is null`;
    if (ctx) await audit(sql(), { unitId: null, action: "admin.signed_out", actor: "admin", adminId: ctx.adminId });
  }
  return noContent({ "set-cookie": sessionCookie(req, "", 0) });
});
