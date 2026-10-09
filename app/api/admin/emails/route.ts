/**
 * GET  /api/admin/emails?limit=50 → 200 EmailMessage[] (the delivery log; bodies are never stored,
 *      so links and codes are absent)
 * POST /api/admin/emails { template, to, link?, code? } → 200 EmailMessage (admin-only; rendered
 *      from the named template, any client text ignored, so this is not an open relay)
 */
import { giftCodeEmail, recoverLinkEmail, senderLinkEmail } from "@/lib/email/templates";
import type { EmailMessage } from "@/lib/services/types";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isoReq, sql } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { env } from "@/lib/server/env";
import { ApiError, body, json, originOf, route } from "@/lib/server/http";
import { z } from "zod";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 50));
  const rows = await sql()<{ id: string; template: EmailMessage["template"]; to_email: string; subject: string; status: string; provider: string; created_at: Date }[]>`
    select id, template, to_email::text as to_email, subject, status, provider, created_at
    from email_log order by created_at desc limit ${limit}`;
  return json(
    rows.map((r): EmailMessage => ({
      id: r.id,
      template: r.template,
      to: r.to_email,
      subject: r.subject,
      text: `(${r.provider === "log" ? "not delivered: no email provider configured" : r.status}; message bodies are not stored)`,
      sentAt: isoReq(r.created_at),
    })),
  );
});

const Body = z.object({
  template: z.enum(["sender_link", "recover_link", "gift_code"]),
  to: z.email().max(254),
  link: z.url().max(500).optional(),
  code: z.string().max(32).optional(),
});

export const POST = route(async (req) => {
  await requireAdmin(req);
  const b = await body(req, Body, 4096);
  const draft =
    b.template === "gift_code"
      ? b.code
        ? giftCodeEmail({ to: b.to, code: b.code, origin: originOf(req, env.publicOrigin()) })
        : null
      : b.link
        ? b.template === "sender_link"
          ? senderLinkEmail({ to: b.to, link: b.link })
          : recoverLinkEmail({ to: b.to, links: [b.link] })
        : null;
  if (!draft) throw new ApiError("invalid_input", "missing link or code for this template");
  return json(await sendEmail(draft, null));
});
