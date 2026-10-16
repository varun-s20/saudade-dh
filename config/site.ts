/**
 * Site-wide configuration. Values marked [OPEN] or [PROPOSED] are waiting on the client;
 * see docs/OPEN_QUESTIONS.md. Change behaviour here, not in components.
 *
 * The four deployment-specific values below come from NEXT_PUBLIC_* build-time variables, so a
 * production build is configured in the host's settings (docs/HANDOVER.md §4) with no code change.
 * Next inlines them at build time; changing one means a rebuild. Unset, they keep the showcase
 * defaults, and the admin's launch checklist (/api/admin/readiness) flags each one still unset.
 */

/** The placeholder chip domain; the launch checklist refuses it for production batches. */
export const PLACEHOLDER_CHIP_DOMAIN = "saudade.example";

/** Characters after "SAUD-": 4 (the agreed example, SAUD-3K7M) or 8 (SAUD-3K7M-Q2XF). See O9. */
const codeLength: 4 | 8 = process.env.NEXT_PUBLIC_CODE_LENGTH?.trim() === "8" ? 8 : 4;

export const site = {
  name: "Saudade",
  tagline: "A letter for someone you miss.",

  /**
   * [OPEN O2] The domain encoded on every NFC chip (NEXT_PUBLIC_CHIP_DOMAIN). Permanent once
   * encoded. Never a provider domain (*.vercel.app). Each batch also records the domain it was
   * generated with, and its factory CSV always uses that one.
   */
  chipDomain: process.env.NEXT_PUBLIC_CHIP_DOMAIN?.trim().toLowerCase() || PLACEHOLDER_CHIP_DOMAIN,

  /** Where customers write for help (NEXT_PUBLIC_SUPPORT_EMAIL). */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "hello@saudade.example",

  /**
   * [PROPOSED O7] When true, a unit only reveals after the sender has sealed it;
   * before that the recipient sees "Your letter is still being written".
   * If the client declines "Seal & send", set false: `filled` units become revealable.
   */
  requireSealBeforeReveal: true,

  /** [OPEN O6] Ask for the sender's email after claiming (for link recovery). */
  captureSenderEmailAtClaim: true,

  /**
   * [SHOWCASE] After sealing, show the sender the address the ceramic's heart opens (with copy and
   * open), so the first tap can be tried without a ceramic. Launch builds set
   * NEXT_PUBLIC_SHOW_RECIPIENT_LINK=0: there the chip is the only way in.
   */
  showRecipientLinkAfterSeal: process.env.NEXT_PUBLIC_SHOW_RECIPIENT_LINK?.trim() !== "0",

  /**
   * Cloudflare Turnstile site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY, with TURNSTILE_SECRET_KEY on the
   * server). Only used when guessing at scale trips the claim breaker (ARCHITECTURE.md §9.2): then
   * every claim passes a quiet bot check for six hours instead of being refused outright.
   */
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,

  /** [PROPOSED] Optional paper/seal sound after the recipient's tap gesture, with a mute toggle. */
  revealSound: true,

  limits: {
    photos: 15,
    /** Longest edge after client-side compression, px. */
    photoMaxEdge: 2048,
    /** Target size after compression, MB. */
    photoTargetMB: 0.6,
    /** Largest original we accept before compression, MB (HEIC from iPhones can be large). */
    photoInputMaxMB: 30,
    photoCaptionChars: 120,
    /** [PROPOSED] Letter body limit, characters. */
    letterChars: 2000,
    letterNameChars: 40,
    /** [PROPOSED] Sign-off line ("Always a short walk away, in the ways that count,"). */
    letterSignoffChars: 80,
    voiceSeconds: 180,
    voiceUploadMaxMB: 25,
  },

  codes: {
    prefix: "SAUD",
    /** Unambiguous alphabet: no 0/O, 1/I/L. 31 symbols. */
    alphabet: "23456789ABCDEFGHJKMNPQRSTUVWXYZ",
    /**
     * Characters after the prefix (NEXT_PUBLIC_CODE_LENGTH). 4 is the agreed example and what the
     * demo data uses; 8 is recommended for every production unit (O9, ARCHITECTURE.md §3.3).
     * One length per deployment: the claim page, batch generation and the server all follow it.
     */
    length: codeLength,
    ambiguous: "01OIL",
  },

  ids: {
    /** NFC slug: lowercase RFC 4648 base32, 12 chars ≈ 60 bits. */
    slugAlphabet: "abcdefghijklmnopqrstuvwxyz234567",
    slugLength: 12,
    /** Sender edit token: 32 chars ≈ 160 bits. */
    tokenLength: 32,
  },

  rateLimit: {
    /** Failed claim attempts allowed per window before a cool-down (prototype values). */
    claimAttempts: 5,
    claimWindowSec: 600,
    claimCooldownSec: 60,
  },

  /** Simulated network latency range for the mock service layer, ms. */
  mockLatencyMs: [300, 900] as const,
} as const;

export type SiteConfig = typeof site;

/** The chip URL for a slug: the configured domain, or a batch's own recorded domain. */
export const recipientUrl = (slug: string, domain: string = site.chipDomain) => `https://${domain}/t/${slug}`;
export const senderPath = (token: string) => `/s/${token}`;
export const recipientPath = (slug: string) => `/t/${slug}`;
