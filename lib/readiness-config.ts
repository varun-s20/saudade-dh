/**
 * The launch-checklist items that depend only on build configuration and bundled content, shared
 * by the server's full checklist (lib/server/readiness.ts) and the prototype's admin. Pure.
 */
import { PLACEHOLDER_CHIP_DOMAIN, site } from "@/config/site";
import { privacyPolicy, termsOfService, wordingSupplied } from "@/content/legal";
import type { ReadinessCheck } from "@/lib/services/types";

/** Hosting-provider domains must never be written to a chip (MASTER_BUILD_PROMPT §12). */
const PROVIDER_DOMAIN = /(^|\.)(vercel\.app|netlify\.app|onrender\.com|supabase\.co|herokuapp\.com|pages\.dev|workers\.dev|github\.io)$/i;

export function configChecks(): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const add = (id: string, label: string, status: ReadinessCheck["status"], detail: string) => checks.push({ id, label, status, detail });

  const domain = site.chipDomain;
  if (domain === PLACEHOLDER_CHIP_DOMAIN) {
    add("chip_domain", "Chip domain", "fail", `Still the placeholder ${domain}. Set NEXT_PUBLIC_CHIP_DOMAIN to Saudade's own domain (O2) and rebuild before generating the launch batch.`);
  } else if (PROVIDER_DOMAIN.test(domain)) {
    add("chip_domain", "Chip domain", "fail", `${domain} belongs to a hosting provider. Chips must carry a domain Saudade owns, or they break when hosting changes.`);
  } else {
    add("chip_domain", "Chip domain", "ok", `Chips will open https://${domain}/t/… (${domain.length + 23} of the NTAG213's 144 bytes).`);
  }

  add(
    "code_length",
    "Activation code length",
    site.codes.length === 8 ? "ok" : "warn",
    site.codes.length === 8
      ? "SAUD-XXXX-XXXX: about 40 bits, safe from guessing at any realistic rate."
      : "SAUD-XXXX (4 characters) can be guessed at scale (ARCHITECTURE.md §3.3). Set NEXT_PUBLIC_CODE_LENGTH=8 before printing the launch cards, once Saudade agrees (O9).",
  );

  add(
    "showcase_link",
    "Showcase-only link after sealing",
    site.showRecipientLinkAfterSeal ? "warn" : "ok",
    site.showRecipientLinkAfterSeal
      ? "Senders are shown the address the heart opens after sealing (for demos without a ceramic). Set NEXT_PUBLIC_SHOW_RECIPIENT_LINK=0 for launch."
      : "Off: the ceramic is the only way to open an envelope.",
  );

  add(
    "support_email",
    "Support address",
    site.supportEmail.endsWith(".example") ? "warn" : "ok",
    site.supportEmail.endsWith(".example") ? `The pages still show ${site.supportEmail}. Set NEXT_PUBLIC_SUPPORT_EMAIL.` : `Pages show ${site.supportEmail}.`,
  );

  const legal = [privacyPolicy, termsOfService].filter((d) => !wordingSupplied(d)).map((d) => d.title);
  add(
    "legal",
    "Privacy Policy and Terms wording",
    legal.length ? "warn" : "ok",
    legal.length
      ? `${legal.join(" and ")} ${legal.length > 1 ? "are" : "is"} still a draft or unfinished. Once Saudade's reviewers approve the wording in content/legal.ts, fill the [bracketed] gaps, set the date and draft: false (O14).`
      : "Both pages carry Saudade's approved wording.",
  );
  return checks;
}
