import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Wenger Field Notes",
  description:
    "Field visit notes for the Wenger Corporation California sales team.",
  // iOS standalone (Add to Home Screen). statusBarStyle "default" keeps
  // the OS status bar reserved (themed by theme-color) so the navy
  // header never underlaps it.
  appleWebApp: {
    capable: true,
    title: "Field Notes",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

// viewport-fit=cover so env(safe-area-inset-*) is live on notched
// devices; theme-color = Wenger navy for the standalone chrome.
export const viewport: Viewport = {
  themeColor: "#0A3758",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
