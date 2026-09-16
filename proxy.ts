import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

// Accessible without a session: login/signup (redirecting an *already*
// signed-in visitor away from these is handled by the pages themselves via
// getSessionUser(), not here -- see the note below) and About.
const PUBLIC_PATHS = ["/login", "/signup", "/about"];

// Fast-path only: presence of the cookie, not whether it's still valid.
// Deliberately does NOT redirect an already-has-a-cookie visitor away from
// /login or /signup -- that used to live here, but a cookie can be present
// yet invalid (expired session row, deleted account, etc.), and this proxy
// has no cheap way to tell. Coupled with getSessionUser()'s real check on
// "/" sending an invalid-cookie visitor back to /login, that created an
// infinite redirect loop with no recovery short of clearing cookies
// manually. The authoritative "already logged in" check now lives in
// login/page.tsx and signup/page.tsx instead, where getSessionUser() can
// settle it correctly.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
