import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIX = "/app";
const AUTH_ROUTES = ["/signin", "/signup", "/forgot-password"];
const ONBOARDING_ROUTE = "/onboarding";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has("access_token") ||
    request.cookies.has("refresh_token");

  const isProtected = pathname.startsWith(PROTECTED_PREFIX);
  const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if ((isProtected || isOnboarding) && !hasSession) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/onboarding",
    "/signin",
    "/signup",
    "/forgot-password",
  ],
};
