import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "FinTrack – Smart Money Management",
  description: "Track your finances effortlessly with AI-powered insights",
};

export default async function RootLayout({ children }) {
  // Pre-fetch user on server so AuthProvider has initial state (no flash)
  let initialUser = null;
  try {
    const session = await getSession();
    if (session) {
      initialUser = await db.user.findUnique({
        where: { id: session.id },
        select: { id: true, email: true, name: true, imageUrl: true },
      });
    }
  } catch {
    // not authenticated — fine
  }

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/assets/images/salary.png" sizes="any" />
      </head>
      <body className="bg-slate-50 antialiased">
        <AuthProvider initialUser={initialUser}>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors position="top-right" />
          <footer className="bg-white border-t border-gray-100 py-8 mt-0">
            <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-700">FinTrack</span>
                <span>— Smart Finance Tracker</span>
              </div>
              <p>Made with ♥ by Neha Chauhan</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
