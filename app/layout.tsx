import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Pickleball Bracket",
  description: "Shared live bracket tracking for wins, losses, and advancing players.",
  other: {
    "codex-preview": "live bracket maker",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
