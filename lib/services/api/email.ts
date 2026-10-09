/**
 * EmailService over HTTP. Production email is sent by the server only (Resend, on the client's
 * domain). There is deliberately no public "send" endpoint (it would be an open relay):
 * `send` is admin-only and the server renders subject/body from the named template, ignoring
 * any client-supplied text. `outbox` lists the server's email_log for the admin.
 */
import type { EmailMessage, EmailService } from "@/lib/services/types";
import { request } from "./http";

export const apiEmailService: EmailService = {
  send(message) {
    return request<EmailMessage>({
      method: "POST",
      path: "/api/admin/emails",
      auth: "admin",
      body: { template: message.template, to: message.to.trim().toLowerCase(), link: message.link, code: message.code },
    });
  },

  async outbox() {
    const res = await request<EmailMessage[]>({ path: "/api/admin/emails", auth: "admin", query: { limit: 50 } });
    return res.ok ? res.data : [];
  },
};
