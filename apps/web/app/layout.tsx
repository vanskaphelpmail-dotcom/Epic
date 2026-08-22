import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/src/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jersey Addicts BD",
  description: "Authentic classic & modern football jerseys — collectors vault for Bangladesh.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased overflow-x-hidden w-full">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
