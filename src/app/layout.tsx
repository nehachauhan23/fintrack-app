import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FinTrack: personal finance on one honest ledger", template: "%s · FinTrack" },
  description: "Track accounts, budgets and goals. Scan receipts, type what you spent, and ask questions about your money in plain English.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f5f6" }, { media: "(prefers-color-scheme: dark)", color: "#0b1215" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-right" theme="system" toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
