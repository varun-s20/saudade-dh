/**
 * PUT /api/sender/email (Bearer) { email } → 204, and the sender_link email goes out with the
 * link built from the token presented (O6: optional, for link recovery). 5 / hour / envelope.
 */
import { senderPath } from "@/config/site";
import { senderLinkEmail } from "@/lib/email/templates";
import { sql } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { env } from "@/lib/server/env";
import { body, limit, noContent, originOf, requireSender, route } from "@/lib/server/http";
import { z } from "zod";

const Body = z.object({ email: z.email().max(254) });

export const PUT = route(async (req) => {
  const { unitId, token } = await requireSender(req);
  await limit("sender_email", unitId, 3600, 5);
  const email = (await body(req, Body, 1024)).email.trim().toLowerCase();
  await sql()`update units set sender_email = ${email} where id = ${unitId}`;
  await sendEmail(senderLinkEmail({ to: email, link: `${originOf(req, env.publicOrigin())}${senderPath(token)}` }), unitId);
  return noContent();
});
