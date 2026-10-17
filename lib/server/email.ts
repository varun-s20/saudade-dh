/**
 * Transactional email: HTML in the site's look, with a plain-text alternative. The server renders
 * every message from lib/email/templates.ts (no public send endpoint, so no open relay). With RESEND_API_KEY set it is delivered through Resend from
 * EMAIL_FROM on the client's verified domain; without it (staging before the domain exists, O2)
 * the message is recorded in email_log as `provider = 'log'` and not delivered.
 * The body is never stored: it carries a private link or an activation code.
 */
import "server-only";
import { withoutHtml, type EmailDraft } from "@/lib/email/templates";
import type { EmailMessage } from "@/lib/services/types";
import { isoReq, sql } from "./db";
import { env } from "./env";

export async function sendEmail(draft: EmailDraft, unitId: string | null): Promise<EmailMessage> {
  const key = env.resendApiKey();
  let provider = "log";
  let status: "sent" | "failed" = "sent";
  let providerId: string | null = null;
  let error: string | null = null;

  if (key) {
    provider = "resend";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.emailFrom(), to: [draft.to], subject: draft.subject, html: draft.html, text: draft.text }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (res.ok) providerId = body?.id ?? null;
      else {
        status = "failed";
        error = `resend ${res.status}: ${body?.message ?? ""}`.slice(0, 500);
      }
    } catch (e) {
      status = "failed";
      error = `resend: ${e instanceof Error ? e.message : "request failed"}`.slice(0, 500);
    }
  }

  const [row] = await sql()<{ id: string; created_at: Date }[]>`
    insert into email_log (unit_id, template, to_email, subject, provider, provider_message_id, status, error, sent_at)
    values (${unitId}, ${draft.template}, ${draft.to}, ${draft.subject}, ${provider}, ${providerId}, ${status}, ${error},
            ${status === "sent" ? new Date() : null})
    returning id, created_at`;
  if (status === "failed") console.error(`[email] ${draft.template} failed: ${error}`);
  return { ...withoutHtml(draft), id: row.id, sentAt: isoReq(row.created_at) };
}
