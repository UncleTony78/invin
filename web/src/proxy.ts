import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Optimistic check only: no session cookie means straight to sign-in, without rendering anything.
 * The real check (is the session valid, which workspace) happens in requireSession() on the server.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // Signed-out visitors to the front door see the landing page; the address stays "/"
    if (request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/landing", request.url));
    const url = new URL("/sign-in", request.url);
    const back = request.nextUrl.pathname + request.nextUrl.search;
    if (back !== "/") url.searchParams.set("next", back);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except sign-in, the landing page, the auth API, customers' invoice links, the component showcase, and static files
  matcher: ["/((?!sign-in|landing|api/auth|api/cron|i/|e/|components|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
