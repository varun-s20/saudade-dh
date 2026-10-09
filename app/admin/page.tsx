import type { Metadata } from "next";
import { LoginScreen } from "@/components/admin/LoginScreen";

export const metadata: Metadata = { title: "Sign in" };

/** S20: admin sign-in (simulated in the prototype). */
export default function AdminLoginPage() {
  return <LoginScreen />;
}
