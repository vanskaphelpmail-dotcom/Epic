import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/src/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.epicvanskap.com"),
  title: {
    default: "Epic Vanskap — Authentic Football Jerseys",
    template: "%s | Epic Vanskap",
  },
  description:
    "Epic Vanskap — authentic classic and modern football jerseys for collectors in Bangladesh. Shop verified kits online. Feni Garden City Market outlet.",
  applicationName: "Epic Vanskap",
  alternates: {
    canonical: "https://www.epicvanskap.com/",
  },
  openGraph: {
    type: "website",
    url: "https://www.epicvanskap.com/",
    siteName: "Epic Vanskap",
    title: "Epic Vanskap — Authentic Football Jerseys",
    description:
      "Authentic classic and modern football jerseys for collectors in Bangladesh. Verified kits, Player Edition, Retro, and more.",
    locale: "en_BD",
  },
  twitter: {
    card: "summary_large_image",
    title: "Epic Vanskap — Authentic Football Jerseys",
    description:
      "Authentic classic and modern football jerseys for collectors in Bangladesh.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/epic-vanskap-logo.png?v=1", type: "image/png" }],
    apple: [{ url: "/epic-vanskap-logo.png?v=1" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
