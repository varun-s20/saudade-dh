import { generateId } from "@/lib/parsing/codes";
import type { EmailMessage, EmailService } from "@/lib/services/types";
import { db, latency, nowIso, ok, ready, update } from "./runtime";

/** Simulated transactional email (production: Resend/Postmark on the client's domain). */
export const emailService: EmailService = {
  async send(message) {
    await ready();
    await latency(0.5);
    const sent: EmailMessage = { ...message, id: generateId("msg"), sentAt: nowIso() };
    update((s) => ({ outbox: [sent, ...s.outbox].slice(0, 100) }));
    return ok(sent);
  },
  async outbox() {
    await ready();
    return db().outbox;
  },
};
