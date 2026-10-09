import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalHome } from "@/components/sender/PortalHome";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "Your envelope" };

/** S7 · Sender portal home. The screen reads [token] with useParams, so it sits inside Suspense. */
export default function SenderHomePage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <PortalHome />
    </Suspense>
  );
}
