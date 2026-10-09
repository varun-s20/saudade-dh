import { site } from "@/config/site";
import type { ContentMap, RecipientEnvelope, RecipientMode, StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";

/** Stamps that have content, in envelope order. Only these are placed during the reveal. */
export function filledKinds(contents: ContentMap): StampKind[] {
  return STAMP_KINDS.filter((k) => Boolean(contents[k]));
}

/**
 * Decide what the recipient sees on /t/[slug]. Pure; shared by the real route and the sender
 * preview (which forces a mode and never records a reveal).
 *
 *   not_found  unknown slug
 *   empty      nothing inside yet, or not sealed while site.requireSealBeforeReveal (O7)
 *   first_tap  sealed (or filled, if sealing is off) and never revealed → the ceremony
 *   repeat     already revealed → calm, straight to the envelope
 */
export function resolveRecipientMode(env: RecipientEnvelope | null): RecipientMode {
  if (!env) return "not_found";
  if (filledKinds(env.contents).length === 0) return "empty";
  if (env.revealedAt || env.status === "revealed") return "repeat";
  if (env.status === "sealed") return "first_tap";
  if (!site.requireSealBeforeReveal && env.status === "filled") return "first_tap";
  return "empty";
}

/** Stamps updated since this device's last visit get a "new" postmark ([PROPOSED]). */
export function newSince(contents: ContentMap, lastVisitIso: string | undefined): Set<StampKind> {
  const out = new Set<StampKind>();
  if (!lastVisitIso) return out;
  for (const k of filledKinds(contents)) {
    const rec = contents[k];
    if (rec && rec.updatedAt > lastVisitIso) out.add(k);
  }
  return out;
}

/** Sender's name for labels ("Open voice message from Mira"), from the letter signature. */
export function senderName(contents: ContentMap): string | null {
  const from = contents.letter?.content.from.trim();
  return from ? from : null;
}

export function recipientName(contents: ContentMap): string | null {
  const to = contents.letter?.content.to.trim();
  return to ? to : null;
}
