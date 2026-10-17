/**
 * The Privacy Policy and Terms of Service (CLIENT_GUIDE §10, OPEN_QUESTIONS O14).
 *
 * STATUS: DRAFT written by the build team from how the system actually works, for Saudade and their
 * legal adviser to review and correct (product owner's request, 16 Oct). It is not legal advice.
 * While `draft` is true the pages say "Draft, under review" and `npm run launch:check` warns.
 *
 * To publish the reviewed wording:
 *   1. replace the paragraphs (one string per paragraph, plain text) and fill every [bracketed] gap;
 *   2. set `updated` to the date Saudade gives ("1 November 2026") and `draft` to false;
 *   3. rebuild. The facts behind this text (retention, processors, regions) are in docs/HANDOVER.md §9:
 *      if the system changes, change both.
 */
import { site } from "@/config/site";

export interface LegalSection {
  title: string;
  /** One string per paragraph. Empty = a "wording to be supplied" placeholder. */
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  /** True until Saudade's reviewers approve the wording. */
  draft: boolean;
  /** The "last updated" date of the approved wording; null until then. */
  updated: string | null;
  sections: LegalSection[];
}

const CONTACT = `Write to us at ${site.supportEmail}. We read every message and reply as soon as we can.`;

export const privacyPolicy: LegalDoc = {
  title: "Privacy Policy",
  intro: "This is a draft of Saudade's Privacy Policy.",
  draft: true,
  updated: null,
  sections: [
    {
      title: "Who we are",
      paragraphs: [
        "Saudade makes ceramic keepsake envelopes with a small NFC chip inside, and the website that holds what the sender puts in them. In this policy, \"Saudade\", \"we\" and \"us\" means [legal name of the business], [registered address].",
        "This policy explains what we collect when you use the website, why, who can see it, how long we keep it, and the choices you have.",
      ],
    },
    {
      title: "What we collect",
      paragraphs: [
        "From the person who sends an envelope (the sender): the content you choose to add (photos, a letter, a voice message, a song link) and, only if you give it to us, an email address so we can send you your private link again if you lose it.",
        "If you bought a gift that ships straight to someone else, the email address the activation code was sent to.",
        "From everyone who visits: basic technical information that any website receives, such as your browser type. We do not store IP addresses. To protect the site against abuse we keep a scrambled, one-way version of the network address for a short time, which cannot be turned back into the address.",
        "We do not ask recipients for any information. Opening an envelope needs no account, no name and no app.",
      ],
    },
    {
      title: "Photos, voice messages, letters and songs",
      paragraphs: [
        "When you add a photo, we shrink it and remove the hidden details cameras attach to it, such as the location where it was taken. We keep only these cleaned copies; the file you uploaded is deleted within 7 days.",
        "When you record or upload a voice message, we convert it into a standard format so it plays on every phone.",
        "When you add a song, we keep the link and the song's title, artist and artwork. The song itself plays through the official Spotify or Apple Music player, and those services' own privacy policies apply to it.",
        "Your content belongs to you. We use it only to show it in your envelope.",
      ],
    },
    {
      title: "How we use it",
      paragraphs: [
        "To show your envelope to whoever taps the ceramic, and to let you edit it with your private link.",
        "To email you your private link or an activation code, when you ask for it or when a gift is set up.",
        "To help you if you contact us, and to keep the service safe (for example, to stop someone guessing activation codes).",
        "We do not sell your information, we do not show advertising, and we do not use analytics or advertising trackers.",
      ],
    },
    {
      title: "Who can see an envelope",
      paragraphs: [
        "Anyone who taps the ceramic, or who has its web address, can open the envelope. That is what makes it simple: no login, no app. If the recipient shares the address, the people they share it with can see the envelope too.",
        "The address is long and random, so it cannot be guessed, and envelopes are hidden from search engines. Photos and voice messages are served through private links that expire.",
        "Only the sender, with their private link, can change what is inside. Saudade's support staff can see an envelope when they need to help you or deal with a problem, and every such action is recorded.",
      ],
    },
    {
      title: "Where it's stored and for how long",
      paragraphs: [
        "We use these service providers, who process information only on our instructions: Vercel (the website), Supabase (the database and file storage, in [region]), Resend (email), Backblaze or Cloudflare (encrypted backups) and Cloudflare Turnstile (a bot check, used only if the site is under attack).",
        "Envelopes have no expiry date: what you put inside stays for as long as Saudade runs the service, so the keepsake keeps working.",
        "When you replace or remove a photo or voice message, we keep it for 90 days so it can be restored if that was a mistake, then delete it. Earlier versions of a letter or song choice are kept so they can be restored.",
        "Encrypted backups are kept for up to 35 days (daily) and 12 months (monthly). Deleted photos and voice messages leave the backups within about three months.",
        "Records of the emails we send (address, subject and time, never the message itself) are kept for 13 months, after which the address is removed.",
      ],
    },
    {
      title: "Your choices and rights",
      paragraphs: [
        "As the sender you can change or remove anything in your envelope at any time with your private link.",
        "You can ask us for a copy of the information we hold about you, to correct it, or to delete it, including deleting an envelope's content and your email address. Write to us (below) from the email address involved, or include the envelope's private link, so we know the request is yours.",
        "[Add the rights and the supervisory authority that apply in Saudade's country, e.g. UK/EU GDPR or US state law, as advised.]",
      ],
    },
    {
      title: "Cookies and on-device storage",
      paragraphs: [
        "We don't use advertising or tracking cookies.",
        "Your browser stores a few small things on your own device to make the site work: on the sender's device, which envelopes you can edit; on any device, whether the envelope has already been opened there, which letters you've read, and whether you turned the sound off.",
        "If you play a song, the Spotify or Apple Music player may set its own cookies under its own policy.",
      ],
    },
    {
      title: "Changes to this policy",
      paragraphs: [
        "If we change this policy we will update the date at the top of this page. If a change matters, we will tell senders who gave us their email address.",
      ],
    },
    {
      title: "Contact us",
      paragraphs: [CONTACT],
    },
  ],
};

export const termsOfService: LegalDoc = {
  title: "Terms of Service",
  intro: "This is a draft of Saudade's Terms of Service.",
  draft: true,
  updated: null,
  sections: [
    {
      title: "About these terms",
      paragraphs: [
        "These terms apply to the Saudade website: claiming an envelope, filling it, and opening it. They are between you and [legal name of the business]. By using the website you agree to them.",
        "Buying the ceramic itself is covered by the terms of the shop you bought it from.",
      ],
    },
    {
      title: "Your envelope and your code",
      paragraphs: [
        "Each ceramic comes with one activation code, on a card in the box or by email. The code can be used once, to claim the envelope and get your private link. Codes never expire.",
        "Keep your code safe until you have used it: whoever uses it first gets the private link. If your code is lost or someone else used it, contact us and we can issue a new one.",
      ],
    },
    {
      title: "What you put inside",
      paragraphs: [
        "You can add photos, a letter, a voice message and a song. You keep all rights to your content. You give Saudade permission to store it, convert it into formats that work on every phone, and show it to whoever opens the envelope, only to provide the service.",
        "You must have the right to share what you add, and it must not be unlawful, hateful, threatening, or anyone's private information shared without their consent.",
        "We may remove content that breaks these terms or the law, or when we are legally required to.",
      ],
    },
    {
      title: "Your private link",
      paragraphs: [
        "Your private link lets you edit the envelope at any time. Anyone who has it can change the envelope, so treat it like a key: don't post it or forward it.",
        "If you lose it, use \"Lost your link?\" on the website with the email address you gave us, or contact us.",
        "The envelope's own address (the one the ceramic opens) can be opened by anyone who has it. That is the price of \"no login, just tap\".",
      ],
    },
    {
      title: "How long envelopes stay online",
      paragraphs: [
        "Envelopes have no expiry date. We intend to keep them online for as long as Saudade runs the service, and we back them up every night.",
        "If we ever have to stop the service, we will give senders who gave us their email address at least [90] days' notice and a way to download what they put in their envelopes.",
      ],
    },
    {
      title: "Things we ask you not to do",
      paragraphs: [
        "Don't try to guess activation codes or envelope addresses, get into envelopes that aren't yours, overload the website, or get around its protections.",
        "Don't use Saudade to harass anyone or to share anything unlawful.",
      ],
    },
    {
      title: "Changes to the service",
      paragraphs: [
        "We may improve or change the website, for example its design. We will keep what you put in your envelope, and the address your ceramic opens, working.",
      ],
    },
    {
      title: "Liability",
      paragraphs: [
        "We work hard to keep Saudade available and your content safe, but the website is provided as it is, and we can't promise it will never be interrupted.",
        "[Liability limits and consumer rights wording for Saudade's country, as advised. Nothing in these terms limits rights you have by law.]",
      ],
    },
    {
      title: "Changes to these terms",
      paragraphs: [
        "If we change these terms we will update the date at the top of this page. If a change matters, we will tell senders who gave us their email address.",
      ],
    },
    {
      title: "Contact us",
      paragraphs: [CONTACT],
    },
  ],
};

/** Whether a document is approved, dated and has wording in every section. */
export const wordingSupplied = (doc: LegalDoc): boolean =>
  !doc.draft && doc.updated !== null && doc.sections.every((s) => s.paragraphs.some((p) => p.trim()));
