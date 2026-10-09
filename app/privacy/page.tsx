import type { Metadata } from "next";
import { LegalDocument } from "@/components/public/LegalDocument";

export const metadata: Metadata = { title: "Privacy Policy" };

/** S6: Privacy Policy template. Wording comes from the client (O14); headings are an outline only. */
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="This page is a styled template for Saudade's Privacy Policy."
      sections={[
        "Who we are",
        "What we collect",
        "Photos, voice messages, letters and songs",
        "How we use it",
        "Who can see an envelope",
        "Where it's stored and for how long",
        "Your choices and rights",
        "Cookies and on-device storage",
        "Changes to this policy",
        "Contact us",
      ]}
    />
  );
}
