import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
        <Search size={36} className="text-blue-400" />
      </div>
      <h1 className="text-6xl font-extrabold text-gray-900 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-gray-600 mb-3">Page Not Found</h2>
      <p className="text-gray-400 max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Home size={16} />
          Back to Home
        </Button>
      </Link>
    </div>
  );
}
