import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaimSuccess } from "@/components/public/ClaimSuccess";
import { PublicShell } from "@/components/public/PublicShell";
import { PaperLoader } from "@/components/ui/PaperLoader";

export const metadata: Metadata = { title: "Your envelope is yours" };

/** S3: after a successful claim. Reads ?t= with useSearchParams, so it sits inside Suspense. */
export default function ClaimSuccessPage() {
  return (
    <PublicShell>
      <Suspense
        fallback={
          <div className="grid min-h-[50dvh] place-items-center">
            <PaperLoader label="Opening your envelope…" />
          </div>
        }
      >
        <ClaimSuccess />
      </Suspense>
    </PublicShell>
  );
}
