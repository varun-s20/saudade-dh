import type { Metadata } from "next";
import { LegalDocument } from "@/components/public/LegalDocument";
import { privacyPolicy } from "@/content/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

/** S6: Privacy Policy. Wording comes from the client (O14) and lives in content/legal.ts. */
export default function PrivacyPage() {
  return <LegalDocument doc={privacyPolicy} />;
}
