/**
 * POST /api/admin/2fa/recovery-codes { code } → 200 { recoveryCodes: string[] }.
 * Replaces every recovery code with 10 new ones (shown once). Needs a two-factor session and a
 * current authenticator code, so a stolen cookie alone can't mint codes.
 */
import { requireAdmin } from "@/lib/server/admin-auth";
import { sql, tx } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { ApiError, body, json, limit, route } from "@/lib/server/http";
import { newRecoveryCodes, openSecret, recoveryHashesHex, verifyTotp } from "@/lib/server/totp";
import { z } from "zod";

const Body = z.object({ code: z.string().max(12) });

export const POST = route(async (req) => {
  const { adminId, twoFactor } = await requireAdmin(req);
  const key = env.totpKey();
  if (!key || twoFactor !== "verified") throw new ApiError("invalid_input", "two-factor sign-in is not set up");
  await limit("totp_confirm", adminId, 900, 10);
  const { code } = await body(req, Body, 1024);

  const [a] = await sql()<{ totp_secret_enc: Buffer | null; totp_last_used_step: string | number | null }[]>`
    select totp_secret_enc, totp_last_used_step from admin_users where id = ${adminId}`;
  const secret = a?.totp_secret_enc ? openSecret(key, adminId, a.totp_secret_enc) : null;
  if (!secret) throw new ApiError("invalid_input", "two-factor sign-in is not set up");
  const step = verifyTotp(secret, code, Date.now(), a.totp_last_used_step === null ? null : Number(a.totp_last_used_step));
  if (step === null) throw new ApiError("invalid_input", "that code didn't match");

  const codes = newRecoveryCodes();
  await tx(async (t) => {
    await t`update admin_users set totp_last_used_step = ${step},
              recovery_code_hashes = array(select decode(h, 'hex') from unnest(string_to_array(${recoveryHashesHex(codes)}::text, ',')) as h)
            where id = ${adminId}`;
    await audit(t, { unitId: null, action: "admin.recovery_codes_reset", actor: "admin", adminId });
  });
  return json({ recoveryCodes: codes });
});
