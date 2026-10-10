import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import "@/styles/globals.css";
import "@/styles/cursor.css";
import { StampCursor } from "@/components/ui/StampCursor";

export const metadata: Metadata = {
  title: { default: "Saudade", template: "%s · Saudade" },
  description: "A letter for someone you miss.",
  // Every page is private by design (CLIENT_GUIDE §7): never indexed, never followed.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // Link previews (iMessage, WhatsApp…) see only this neutral card, never envelope content.
  openGraph: { title: "Saudade", description: "Something is waiting for you.", type: "website" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f1e8",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <StampCursor />
        </Providers>
      </body>
    </html>
  );
}
