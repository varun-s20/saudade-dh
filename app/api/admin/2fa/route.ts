/**
 * GET /api/admin/2fa → 200 AdminSecurity: whether 2FA is on for this deployment, whether the
 * signed-in admin has an authenticator, and how many recovery codes are left. Open to an `enrol`
 * session (it is what the enrolment screen reads first).
 */
import { requireAdmin, twoFactorRequired } from "@/lib/server/admin-auth";
import { iso, sql } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import type { AdminSecurity } from "@/lib/services/types";

export const GET = route(async (req) => {
  const { adminId } = await requireAdmin(req, { allowEnrol: true });
  const [a] = await sql()<{ totp_enrolled_at: Date | null; left: number }[]>`
    select totp_enrolled_at, coalesce(array_length(recovery_code_hashes, 1), 0)::int as left
    from admin_users where id = ${adminId}`;
  const security: AdminSecurity = {
    twoFactor: !twoFactorRequired() ? "off" : a?.totp_enrolled_at ? "enrolled" : "not_enrolled",
    enrolledAt: iso(a?.totp_enrolled_at),
    recoveryCodesLeft: a?.left ?? 0,
  };
  return json(security);
});
