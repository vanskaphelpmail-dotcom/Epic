import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/src/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Epic Vanskap",
  description: "Authentic classic & modern football jerseys — collectors vault.",
  icons: {
    icon: [{ url: "/epic-vanskap-logo.png?v=1", type: "image/png" }],
    apple: [{ url: "/epic-vanskap-logo.png?v=1" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, etc.) inject attributes on <html>/<body>
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased overflow-x-hidden w-full" suppressHydrationWarning>
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
