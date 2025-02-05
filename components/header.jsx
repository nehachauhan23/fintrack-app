import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "@/lib/checkUser";

const Header = async() => {
  const user = await checkUser();
  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-blue-md z-50 border-b box-border">
      <nav className="container mx-auto max-w-full px-4 py-4 flex items-center justify-between overflow-x-hidden">
        <Link href="/" className="flex items-center">
          <Image
            src="https://img.icons8.com/?size=100&id=113854&format=png&color=000000" // External image URL
            width={75}
            height={60}
            alt="FinTrack Logo"
          />
          <span className=" gradient-title font-bold text-3xl">FinTrack</span>
        </Link>

        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link
              href={"/dashboard"}
              className="text-gray-600 hover:text-blue-500 flex items-center gap-2"
            >
              <Button variant="outline">
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>
            <Link href={"/transaction/create"}>
              <Button  className="display-flex items-center gap-2">
                <PenBox size={18} />
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </Link>
          </SignedIn>

          <SignedOut>
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="outline">Login</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton appearance={{
              elements:{
                avatarBox: "w-10 h-10"
              }
            }} />
          </SignedIn>
        </div>
      </nav>
    </div>
  );
};

export default Header;
