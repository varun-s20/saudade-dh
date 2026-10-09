import type { Metadata } from "next";
import { Suspense } from "react";
import { VoiceEditor } from "@/components/sender/VoiceEditor";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "Voice message" };

/** S10 · Voice editor. Reads [token] with useParams, so it sits inside Suspense. */
export default function SenderVoicePage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <VoiceEditor />
    </Suspense>
  );
}
