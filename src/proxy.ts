import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/accounts", "/transactions", "/budgets", "/goals", "/recurring", "/reports", "/assistant", "/settings"];

/**
 * Optimistic redirect only: it checks that a session cookie exists, nothing more. The cookie is *validated*
 * (and authorisation enforced) in the data-access layer on every page, action and route handler, so bypassing
 * this file never exposes data. It deliberately does not bounce signed-in users away from /sign-in, because a stale
 * cookie would then loop between the two pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !req.cookies.has("ft_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"] };
