/**
 * POST /api/recover  { email }  →  202, always (no account enumeration).
 * If the email is on any claimed envelope, a fresh private link is minted per envelope (the old
 * link can't be re-sent: only its hash exists) and one recover_link email goes out.
 * 429 after 10 / day / IP or 3 / hour per email address.
 */
import { senderPath } from "@/config/site";
import { recoverLinkEmail } from "@/lib/email/templates";
import { ipKey, sha256 } from "@/lib/server/crypto";
import { sql, tx } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { audit } from "@/lib/server/envelopes";
import { env } from "@/lib/server/env";
import { accepted, body, clientIp, limit, originOf, route } from "@/lib/server/http";
import { issueToken } from "@/lib/server/tokens";
import { z } from "zod";

const Body = z.object({ email: z.email().max(254) });

export const POST = route(async (req) => {
  await limit("recover_ip", ipKey(clientIp(req)), 86_400, 10);
  const email = (await body(req, Body, 1024)).email.trim().toLowerCase();
  await limit("recover_email", sha256(email).subarray(0, 12).toString("hex"), 3600, 3);

  const units = await sql()<{ id: string }[]>`
    select id from units where sender_email = ${email} and code_redeemed_at is not null order by updated_at desc limit 10`;
  if (units.length) {
    const origin = originOf(req, env.publicOrigin());
    const links: string[] = [];
    await tx(async (t) => {
      for (const u of units) {
        links.push(`${origin}${senderPath(await issueToken(t, u.id, "recover"))}`);
        await audit(t, { unitId: u.id, action: "unit.token_issued", actor: "system", detail: "recover" });
      }
    });
    await sendEmail(recoverLinkEmail({ to: email, links }), units[0].id);
  }
  return accepted();
});
