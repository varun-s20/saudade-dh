import { AdminShell } from "@/components/admin/AdminShell";

/** Signed-in admin pages share one shell (header, nav, session guard) that stays mounted. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
