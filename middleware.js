import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PROTECTED_ROUTES = ["/dashboard", "/account", "/transaction"];
const AUTH_ROUTES = ["/sign-in", "/sign-up"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fintrack_token")?.value;

  // Validate session from authentication token
  const session = await verifyToken(token);

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect unauthenticated users to the sign-in page
  if (isProtected && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("from", pathname);

    return NextResponse.redirect(url);
  }

  // Prevent authenticated users from accessing authentication pages
  if (isAuthRoute && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";

    return NextResponse.redirect(url);
  }

  // Continue request processing
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};