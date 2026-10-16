import type { Metadata } from "next";
import { LegalDocument } from "@/components/public/LegalDocument";
import { termsOfService } from "@/content/legal";

export const metadata: Metadata = { title: "Terms of Service" };

/** S6: Terms of Service. Wording comes from the client (O14) and lives in content/legal.ts. */
export default function TermsPage() {
  return <LegalDocument doc={termsOfService} />;
}
