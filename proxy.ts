import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

// Only makes sense signed out -- an already-signed-in visitor is bounced
// back to "/" instead of seeing a login/signup form.
const AUTH_PATHS = ["/login", "/signup"];

// Accessible either way, signed in or not -- never redirects in either
// direction. (The page itself also has no auth check, so this just keeps
// the two in sync.)
const PUBLIC_PATHS = ["/about"];

// Fast-path only: presence of the cookie, not whether it's still valid --
// the authoritative check happens per-request via getSessionUser() in each
// page, since a present cookie could still be expired/deleted server-side.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const path = request.nextUrl.pathname;
  const isAuthPath = AUTH_PATHS.includes(path);
  const isPublicPath = PUBLIC_PATHS.includes(path);

  if (!hasSession && !isAuthPath && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isAuthPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
