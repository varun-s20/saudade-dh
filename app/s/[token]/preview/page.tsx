import type { Metadata } from "next";
import { Suspense } from "react";
import { PreviewScreen } from "@/components/recipient/PreviewScreen";
import { RecipientLoading } from "@/components/recipient/RecipientLoading";

export const metadata: Metadata = { title: "Preview" };

/**
 * S13 · Sender preview of the recipient's page. Never counts as the first open (R-42).
 * The screen reads [token] with useParams, so it renders inside Suspense (Cache Components).
 */
export default function PreviewPage() {
  return (
    <Suspense fallback={<RecipientLoading label="Opening the preview…" />}>
      <PreviewScreen />
    </Suspense>
  );
}
