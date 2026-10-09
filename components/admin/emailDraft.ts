/**
 * Draft of the Path B "gift_code" email, for the admin's preview-before-send. Built from the same
 * template the service sends (lib/email/templates.ts), so the preview always matches.
 * Phase 3 note: production mints a fresh code when emailing (codes are stored hashed), so the
 * preview there should show the code as "a new code will be generated" (ARCHITECTURE.md §3.2).
 */
import type { EmailLike } from "@/components/public/EmailPreview";
import { giftCodeEmail } from "@/lib/email/templates";

export function giftCodeDraft(code: string, to: string, origin: string): EmailLike {
  return giftCodeEmail({ code, to, origin });
}

/** Loose email check for admin input (the server validates properly). */
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
