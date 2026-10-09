import type { Metadata } from "next";
import { LegalDocument } from "@/components/public/LegalDocument";

export const metadata: Metadata = { title: "Terms of Service" };

/** S6: Terms of Service template. Wording comes from the client (O14); headings are an outline only. */
export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro="This page is a styled template for Saudade's Terms of Service."
      sections={[
        "About these terms",
        "Your envelope and your code",
        "What you put inside",
        "Your private link",
        "How long envelopes stay online",
        "Things we ask you not to do",
        "Changes to the service",
        "Liability",
        "Changes to these terms",
        "Contact us",
      ]}
    />
  );
}
