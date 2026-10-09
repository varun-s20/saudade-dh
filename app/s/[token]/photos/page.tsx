import type { Metadata } from "next";
import { Suspense } from "react";
import { PhotosEditor } from "@/components/sender/PhotosEditor";
import { SenderFallback } from "@/components/sender/SenderFallback";

export const metadata: Metadata = { title: "Photos" };

/** S8 · Photos editor. Reads [token] with useParams, so it sits inside Suspense. */
export default function SenderPhotosPage() {
  return (
    <Suspense fallback={<SenderFallback />}>
      <PhotosEditor />
    </Suspense>
  );
}
