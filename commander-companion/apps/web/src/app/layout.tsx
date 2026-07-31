import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commander Companion (Unofficial)",
  description:
    "An unofficial, citation-first Magic: The Gathering Commander rules and deck companion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
