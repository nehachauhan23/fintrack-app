import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Fintrack",
  description: "Track your finances like a pro",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/assets/images/salary.png" sizes="any" />
        </head>
        <body className={`${inter.className} bg-gray-100`}>

          <Header />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors />

          <footer className="bg-blue-50 py-12">
            <div className="container mx-auto px-4 text-center text-gray-600">
              <p>Made By Neha Chauhan</p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
