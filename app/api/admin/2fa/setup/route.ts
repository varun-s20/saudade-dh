/**
 * POST /api/admin/2fa/setup → 200 TwoFactorSetup { pending, secret, otpauthUrl, qrDataUrl }.
 *
 * Starts authenticator enrolment. Nothing is stored yet: the new secret goes back to the browser
 * inside an encrypted 10-minute `pending` token, and only POST /api/admin/2fa/confirm with a
 * correct first code saves it. An `enrol` session (no authenticator yet) may call this; an admin
 * replacing an authenticator must already be signed in with two factors.
 */
import { requireAdmin } from "@/lib/server/admin-auth";
import { env } from "@/lib/server/env";
import { ApiError, json, limit, route } from "@/lib/server/http";
import { base32Encode, newSecret, otpauthUrl, pendingToken } from "@/lib/server/totp";
import type { TwoFactorSetup } from "@/lib/services/types";
import QRCode from "qrcode";

export const POST = route(async (req) => {
  const { adminId, session } = await requireAdmin(req, { allowEnrol: true });
  const key = env.totpKey();
  if (!key) throw new ApiError("invalid_input", "two-factor sign-in is not switched on (TOTP_ENC_KEY)");
  await limit("totp_setup", adminId, 3600, 20);

  const secret = newSecret();
  const url = otpauthUrl(secret, session.email);
  const setup: TwoFactorSetup = {
    pending: pendingToken(key, adminId, secret, Date.now()),
    secret: base32Encode(secret),
    otpauthUrl: url,
    qrDataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 232, color: { dark: "#1f2a37", light: "#ffffff" } }),
  };
  return json(setup);
});
