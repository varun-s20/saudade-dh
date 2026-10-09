/**
 * Site-wide configuration. Values marked [OPEN] or [PROPOSED] are waiting on the client;
 * see docs/OPEN_QUESTIONS.md. Change behaviour here, not in components.
 */

export const site = {
  name: "Saudade",
  tagline: "A letter for someone you miss.",

  /**
   * [OPEN O2] The domain encoded on every NFC chip. Permanent once encoded.
   * Placeholder only. Never encode a provider domain (*.vercel.app).
   */
  chipDomain: "saudade.example",

  supportEmail: "hello@saudade.example",

  /**
   * [PROPOSED O7] When true, a unit only reveals after the sender has sealed it;
   * before that the recipient sees "Your letter is still being written".
   * If the client declines "Seal & send", set false: `filled` units become revealable.
   */
  requireSealBeforeReveal: true,

  /** [OPEN O6] Ask for the sender's email after claiming (for link recovery). */
  captureSenderEmailAtClaim: true,

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
    /** Characters after the prefix. Prototype: 4 (agreed example SAUD-3K7M). See O9. */
    length: 4,
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

export const recipientUrl = (slug: string) => `https://${site.chipDomain}/t/${slug}`;
export const senderPath = (token: string) => `/s/${token}`;
export const recipientPath = (slug: string) => `/t/${slug}`;
