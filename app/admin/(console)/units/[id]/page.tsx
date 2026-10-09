import type { Metadata } from "next";
import { Suspense } from "react";
import { UnitDetailScreen } from "@/components/admin/UnitDetailScreen";
import { Skeleton } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Unit" };

/** S23: unit detail. The screen reads [id] with useParams, so it must sit inside Suspense. */
export default function UnitDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <UnitDetailScreen />
    </Suspense>
  );
}
