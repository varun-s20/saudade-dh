/**
 * Transactional email copy: the single source for every email Saudade sends. Used by the server
 * (lib/server/email.ts), the mock services and the admin's preview-before-send, so wording never
 * drifts. Each template's words fill both the plain-text body and the branded HTML (./html.ts).
 *
 * Voice: warm, brief, plain. SQ7: link emails say to use Safari/Chrome for voice recording.
 */
import { site } from "@/config/site";
import type { EmailMessage } from "@/lib/services/types";
import { renderEmailHtml, type EmailContent } from "./html";

/** A message ready to send: the stored fields plus its HTML body (never stored). */
export type EmailDraft = Omit<EmailMessage, "id" | "sentAt"> & { html: string };

/** The stored/returned shape: everything but the HTML body. */
export function withoutHtml(draft: EmailDraft): Omit<EmailMessage, "id" | "sentAt"> {
  const message: Partial<EmailDraft> = { ...draft };
  delete message.html;
  return message as Omit<EmailMessage, "id" | "sentAt">;
}

const VOICE_TIP = "To record a voice message, open the link in Safari or Chrome. Some apps' built-in browsers block the microphone.";

const originOf = (url: string) => {
  try {
    const { origin } = new URL(url);
    return origin === "null" ? "" : origin;
  } catch {
    return "";
  }
};

function compose(
  base: Omit<EmailMessage, "id" | "sentAt" | "text">,
  content: EmailContent,
  text: string,
  origin: string,
): EmailDraft {
  return { ...base, text, html: renderEmailHtml(content, { subject: base.subject, origin, supportEmail: site.supportEmail }) };
}

export function senderLinkEmail(p: { to: string; link: string }): EmailDraft {
  const lead = "Here's the private link to your envelope. Anyone with this link can edit what's inside, so keep it somewhere safe.";
  const after = "Come back any time to add, change, or remove things. Your code never expires.";
  return compose(
    { template: "sender_link", to: p.to.trim().toLowerCase(), subject: "Your Saudade envelope link", link: p.link },
    {
      preheader: "Keep this link: it opens your envelope, any time.",
      eyebrow: "Your private link",
      heading: "Your envelope",
      script: "is waiting.",
      paragraphs: [lead, after],
      buttons: [{ label: "Open your envelope", href: p.link }],
      fallbackLink: p.link,
      note: VOICE_TIP,
      footer: "You asked us to email you this link when you filled your envelope.",
    },
    `${lead}\n\n${p.link}\n\n${after}\n\n${VOICE_TIP}`,
    originOf(p.link),
  );
}

export function recoverLinkEmail(p: { to: string; links: string[] }): EmailDraft {
  const many = p.links.length > 1;
  const lead = `Someone (hopefully you) asked for the link to your Saudade envelope${many ? "s" : ""}.`;
  const ignore = "If this wasn't you, you can ignore this email.";
  return compose(
    { template: "recover_link", to: p.to.trim().toLowerCase(), subject: "Your link back to your envelope", link: p.links[0] },
    {
      preheader: `Here's the way back to your envelope${many ? "s" : ""}.`,
      eyebrow: "Find your link",
      heading: "Back to your",
      script: many ? "envelopes." : "envelope.",
      paragraphs: [
        lead,
        `${many ? "Each button opens one envelope." : "The button opens it."} Keep this email somewhere safe: anyone with the link can edit what's inside.`,
      ],
      buttons: p.links.map((href, i) => ({ label: many ? `Open envelope ${i + 1}` : "Open your envelope", href })),
      fallbackLink: many ? undefined : p.links[0],
      note: VOICE_TIP,
      footer: ignore,
    },
    `${lead}\n\n${p.links.join("\n")}\n\n${VOICE_TIP}\n\n${ignore}`,
    originOf(p.links[0] ?? ""),
  );
}

export function giftCodeEmail(p: { to: string; code: string; origin: string }): EmailDraft {
  const claim = `${p.origin}/claim`;
  const lead =
    "Thank you for your order. Your envelope is on its way to your friend, and there's no card in the box, so what goes inside stays a surprise until you're ready.";
  return compose(
    { template: "gift_code", to: p.to.trim().toLowerCase(), subject: "Your Saudade envelope code", code: p.code, link: claim },
    {
      preheader: `Your code ${p.code} opens your envelope. It never expires.`,
      eyebrow: "Your envelope code",
      heading: "Fill it with",
      script: "something true.",
      paragraphs: [lead, "Enter the code below to start filling your envelope. It never expires."],
      code: p.code,
      buttons: [{ label: "Enter your code", href: claim }],
      fallbackLink: claim,
      footer: "You're getting this because a Saudade envelope was bought with this email address.",
    },
    `${lead}\n\nYour code: ${p.code}\n\nEnter it at ${claim} to start filling your envelope. Your code never expires.`,
    p.origin,
  );
}
