import type { Metadata } from "next";
import { DashboardScreen } from "@/components/admin/DashboardScreen";

export const metadata: Metadata = { title: "Dashboard" };

/** S21: admin dashboard. */
export default function DashboardPage() {
  return <DashboardScreen />;
}
