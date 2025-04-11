import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "@/lib/checkUser";

const Header = async () => {
  const user = await checkUser();
  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b box-border shadow-md">
      <nav className="container mx-auto max-w-full px-4 py-4 flex items-center justify-between flex-nowrap space-x-2 overflow-x-auto">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/assets/images/fintracklogo.png"
            width={75}
            height={60}
            alt="FinTrack Logo"
          />
          <span className="hidden sm:inline font-bold text-3xl text-[#254c87]">
            FinTrack
          </span>

        </Link>

        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-blue-500 flex items-center gap-2 transition-colors duration-300"
              aria-label="Go to Dashboard"
            >
              <Button variant="outline" className="px-4 py-2">
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>

            <Link href="/transaction/create">
              <Button className="px-4 py-2 flex items-center gap-2 transition-all duration-300 hover:scale-105">
                <PenBox size={18} />
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </Link>
          </SignedIn>

          <SignedOut>
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="outline" className="px-4 py-2">
                Login
              </Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-12 h-12 border-2 border-blue-500 rounded-full",
                },
              }}
            />
          </SignedIn>
        </div>
      </nav>
    </div>
  );
};

export default Header;
