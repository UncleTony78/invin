import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Optimistic check only: no session cookie means straight to sign-in, without rendering anything.
 * The real check (is the session valid, which workspace) happens in requireSession() on the server.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    const back = request.nextUrl.pathname + request.nextUrl.search;
    if (back !== "/") url.searchParams.set("next", back);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except sign-in, the auth API, customers' invoice links, the component showcase, and static files
  matcher: ["/((?!sign-in|api/auth|api/cron|i/|components|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
