import type { Metadata } from "next";
import { Suspense } from "react";
import { SongEditor } from "@/components/sender/SongEditor";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "A song for them" };

/** S11 · Song editor. Reads [token] with useParams, so it sits inside Suspense. */
export default function SenderSongPage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <SongEditor />
    </Suspense>
  );
}
