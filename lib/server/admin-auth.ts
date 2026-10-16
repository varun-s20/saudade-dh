/**
 * Admin sessions (ARCHITECTURE.md §9.4): a 256-bit random id in an HttpOnly, SameSite=Strict
 * cookie; only its SHA-256 is stored. 12 h idle / 7 d absolute. Every non-GET admin request must
 * also carry `X-Saudade-CSRF: 1` and a same-origin `Origin` header.
 *
 * Over https the cookie is `__Host-saudade_admin` (Secure, host-only). Plain-http local dev uses
 * `saudade_admin` without Secure, because some browsers refuse Secure cookies on http://localhost.
 *
 * Two-factor (AQ5): with TOTP_ENC_KEY set, a session only opens the panel once it was signed in
 * with a one-time code (`mfa_verified`). An admin with no authenticator yet gets an `enrol`
 * session that can do nothing but set one up.
 */
import "server-only";
import type { NextRequest } from "next/server";
import type { AdminSession, AdminTwoFactor } from "@/lib/services/types";
import { sha256 } from "./crypto";
import { isoReq, sql } from "./db";
import { env } from "./env";
import { ApiError } from "./http";

const IDLE_MS = 12 * 3600_000;
export const SESSION_DAYS = 7;

const secure = (req: NextRequest) => (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https";
export const cookieName = (req: NextRequest) => (secure(req) ? "__Host-saudade_admin" : "saudade_admin");

export function sessionCookie(req: NextRequest, value: string, maxAgeSec: number): string {
  const parts = [`${cookieName(req)}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSec}`];
  if (secure(req)) parts.push("Secure");
  return parts.join("; ");
}

export interface AdminContext {
  adminId: string;
  session: AdminSession;
  /** Shorthand for session.twoFactor. */
  twoFactor: AdminTwoFactor;
}

/** Whether this deployment requires a second factor (TOTP_ENC_KEY is set). */
export const twoFactorRequired = (): boolean => env.totpKey() !== null;

/**
 * A session's two-factor state, or null when the session can't be used: 2FA is on, the admin has
 * an authenticator, but this session never proved it (it predates 2FA being switched on).
 */
export function twoFactorState(mfaVerified: boolean, enrolled: boolean): AdminTwoFactor | null {
  if (!twoFactorRequired()) return "off";
  if (mfaVerified) return "verified";
  return enrolled ? null : "enrol";
}

/** The signed-in admin, or null. Bumps last_seen_at (idle timeout). */
export async function adminFromRequest(req: NextRequest): Promise<AdminContext | null> {
  const raw = req.cookies.get(cookieName(req))?.value;
  if (!raw || raw.length > 100) return null;
  const [row] = await sql()<{ admin_id: string; email: string; created_at: Date; mfa_verified: boolean; enrolled: boolean }[]>`
    update admin_sessions s set last_seen_at = now()
    from admin_users a
    where s.id_hash = ${sha256(raw)}
      and s.admin_id = a.id
      and s.revoked_at is null
      and s.expires_at > now()
      and s.last_seen_at > now() - make_interval(secs => ${IDLE_MS / 1000})
      and a.disabled_at is null
    returning s.admin_id, a.email::text as email, s.created_at, s.mfa_verified, (a.totp_enrolled_at is not null) as enrolled`;
  if (!row) return null;
  const twoFactor = twoFactorState(row.mfa_verified, row.enrolled);
  if (!twoFactor) return null;
  return { adminId: row.admin_id, twoFactor, session: { email: row.email, signedInAt: isoReq(row.created_at), twoFactor } };
}

/**
 * Require a signed-in admin; for non-GET also the CSRF header and a same-origin Origin. A session
 * that still has to enrol an authenticator is refused (403 "two_factor_enrolment") unless the
 * route is part of enrolment itself (`allowEnrol`).
 */
export async function requireAdmin(req: NextRequest, opts: { allowEnrol?: boolean } = {}): Promise<AdminContext> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.headers.get("x-saudade-csrf") !== "1") throw new ApiError("unauthorized", "csrf", undefined, 403);
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) throw new ApiError("unauthorized", "origin", undefined, 403);
  }
  const ctx = await adminFromRequest(req);
  if (!ctx) throw new ApiError("unauthorized", "not signed in");
  if (ctx.twoFactor === "enrol" && !opts.allowEnrol) throw new ApiError("unauthorized", "two_factor_enrolment", undefined, 403);
  return ctx;
}
