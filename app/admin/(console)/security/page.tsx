import type { Metadata } from "next";
import { SecurityScreen } from "@/components/admin/SecurityScreen";

export const metadata: Metadata = { title: "Security" };

/** Admin two-factor sign-in: set up an authenticator, recovery codes (AQ5). */
export default function SecurityPage() {
  return <SecurityScreen />;
}
