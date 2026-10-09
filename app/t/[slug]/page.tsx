import type { Metadata } from "next";
import { Suspense } from "react";
import { RecipientLoading } from "@/components/recipient/RecipientLoading";
import { RecipientRoute } from "@/components/recipient/RecipientRoute";

/**
 * Neutral on purpose: link previews (iMessage, WhatsApp…) and browser tabs see only this, never
 * names, photos or the song (D-016, RESEARCH §4.9). Never indexed (also sent as X-Robots-Tag).
 */
export const metadata: Metadata = {
  title: { absolute: "A letter for you" },
  description: "Something is waiting for you.",
  openGraph: { title: "A letter for you", description: "Something is waiting for you.", type: "website", siteName: "Saudade" },
  twitter: { card: "summary", title: "A letter for you", description: "Something is waiting for you." },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * S15–S19 · The recipient's page, opened by tapping the ceramic heart. No login, no app.
 * The screen reads [slug] with useParams, so it renders inside Suspense (Cache Components).
 * Nothing on this route records anything on load (README rule 13).
 */
export default function RecipientPage() {
  return (
    <main id="main" className="overflow-x-clip">
      <Suspense fallback={<RecipientLoading />}>
        <RecipientRoute />
      </Suspense>
    </main>
  );
}
