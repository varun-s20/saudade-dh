import type { Metadata } from "next";
import { Suspense } from "react";
import { SealScreen } from "@/components/sender/SealScreen";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "Seal & send" };

/** S14 · Seal & send [PROPOSED, O7]. Reads [token] with useParams, so it sits inside Suspense. */
export default function SenderSealPage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <SealScreen />
    </Suspense>
  );
}
