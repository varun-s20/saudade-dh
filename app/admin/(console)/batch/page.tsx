import type { Metadata } from "next";
import { BatchScreen } from "@/components/admin/BatchScreen";

export const metadata: Metadata = { title: "Batches" };

/** S24: batch provisioning and the NFC CSV. */
export default function BatchPage() {
  return <BatchScreen />;
}
