/**
 * Transactional email copy: the single source for every email Saudade sends. Used by the mock
 * email/admin services and by the admin's preview-before-send, so wording never drifts.
 * Phase 3: the server renders the same templates (Resend/Postmark, plain text + simple HTML).
 *
 * Voice: warm, brief, plain. SQ7: link emails say to use Safari/Chrome for voice recording.
 */
import type { EmailMessage } from "@/lib/services/types";

export type EmailDraft = Omit<EmailMessage, "id" | "sentAt">;

const VOICE_TIP = "To record a voice message, open the link in Safari or Chrome. Some apps' built-in browsers block the microphone.";

export function senderLinkEmail(p: { to: string; link: string }): EmailDraft {
  return {
    template: "sender_link",
    to: p.to.trim().toLowerCase(),
    subject: "Your Saudade envelope link",
    link: p.link,
    text: `Here's the private link to your envelope. Anyone with this link can edit what's inside, so keep it somewhere safe.\n\n${p.link}\n\nCome back any time to add, change, or remove things. Your code never expires.\n\n${VOICE_TIP}`,
  };
}

export function recoverLinkEmail(p: { to: string; links: string[] }): EmailDraft {
  const many = p.links.length > 1;
  return {
    template: "recover_link",
    to: p.to.trim().toLowerCase(),
    subject: "Your link back to your envelope",
    link: p.links[0],
    text: `Someone (hopefully you) asked for the link to your Saudade envelope${many ? "s" : ""}.\n\n${p.links.join("\n")}\n\n${VOICE_TIP}\n\nIf this wasn't you, you can ignore this email.`,
  };
}

export function giftCodeEmail(p: { to: string; code: string; origin: string }): EmailDraft {
  const claim = `${p.origin}/claim`;
  return {
    template: "gift_code",
    to: p.to.trim().toLowerCase(),
    subject: "Your Saudade envelope code",
    code: p.code,
    link: claim,
    text: `Thank you for your order. Your envelope is on its way to your friend, and there's no card in the box, so what goes inside stays a surprise until you're ready.\n\nYour code: ${p.code}\n\nEnter it at ${claim} to start filling your envelope. Your code never expires.`,
  };
}
