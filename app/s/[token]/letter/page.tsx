import type { Metadata } from "next";
import { Suspense } from "react";
import { LetterEditor } from "@/components/sender/LetterEditor";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "Your letter" };

/** S9 · Letter editor. Reads [token] with useParams, so it sits inside Suspense. */
export default function SenderLetterPage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <LetterEditor />
    </Suspense>
  );
}
