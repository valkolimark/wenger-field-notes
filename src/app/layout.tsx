import type { Metadata } from "next";
import "./globals.css";
import { RepProvider } from "@/components/shell/rep-context";

export const metadata: Metadata = {
  title: "Wenger Field Notes",
  description:
    "Field visit notes for the Wenger Corporation California sales team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <RepProvider>{children}</RepProvider>
      </body>
    </html>
  );
}
