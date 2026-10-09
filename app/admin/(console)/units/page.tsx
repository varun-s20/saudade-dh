import type { Metadata } from "next";
import { Suspense } from "react";
import { UnitsScreen } from "@/components/admin/UnitsScreen";
import { Skeleton } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Units" };

/** S22: units table. The screen reads ?search / ?status / ?page, so it sits inside Suspense. */
export default function UnitsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <UnitsScreen />
    </Suspense>
  );
}
