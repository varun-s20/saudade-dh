/**
 * POST /api/admin/2fa/confirm { pending, code } → 200 { recoveryCodes: string[] }.
 *
 * Proves the authenticator works (the first code must match the pending secret), then stores the
 * secret encrypted, issues 10 single-use recovery codes (shown this once; only their hashes are
 * kept) and upgrades the current session to two-factor. Replaces any earlier authenticator.
 */
import { sha256 } from "@/lib/server/crypto";
import { cookieName, requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { ApiError, body, json, limit, route } from "@/lib/server/http";
import { newRecoveryCodes, readPendingToken, recoveryHashesHex, sealSecret, verifyTotp } from "@/lib/server/totp";
import { z } from "zod";

const Body = z.object({ pending: z.string().max(400), code: z.string().max(12) });

export const POST = route(async (req) => {
  const { adminId } = await requireAdmin(req, { allowEnrol: true });
  const key = env.totpKey();
  if (!key) throw new ApiError("invalid_input", "two-factor sign-in is not switched on (TOTP_ENC_KEY)");
  await limit("totp_confirm", adminId, 900, 10);
  const { pending, code } = await body(req, Body, 2048);

  const secret = readPendingToken(key, adminId, pending, Date.now());
  if (!secret) throw new ApiError("invalid_input", "setup expired: start again");
  const step = verifyTotp(secret, code, Date.now(), null);
  if (step === null) throw new ApiError("invalid_input", "that code didn't match: check the time on your phone and try the next one");

  const codes = newRecoveryCodes();
  const raw = req.cookies.get(cookieName(req))?.value ?? "";
  await tx(async (t) => {
    await t`update admin_users set totp_secret_enc = ${sealSecret(key, adminId, secret)}, totp_enrolled_at = now(),
              totp_last_used_step = ${step},
              recovery_code_hashes = array(select decode(h, 'hex') from unnest(string_to_array(${recoveryHashesHex(codes)}::text, ',')) as h)
            where id = ${adminId}`;
    // This session just proved the second factor; every other session must sign in again.
    await t`update admin_sessions set mfa_verified = true where id_hash = ${sha256(raw)}`;
    await t`update admin_sessions set revoked_at = now() where admin_id = ${adminId} and id_hash <> ${sha256(raw)} and revoked_at is null`;
    await audit(t, { unitId: null, action: "admin.two_factor_enrolled", actor: "admin", adminId });
  });
  return json({ recoveryCodes: codes });
});
