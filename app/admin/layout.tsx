import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Saudade" },
};

/** Admin area: calmer, utilitarian paper tones (CLIENT_GUIDE §6.6), and the system cursor (a tool). */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-admin-bg text-admin-ink" data-native-cursor>
      {children}
    </div>
  );
}
