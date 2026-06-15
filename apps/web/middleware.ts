import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getTenantSlugFromPath,
  rewriteLegacyAppPath,
  tenantRoot,
} from "@/lib/navigation/tenant-routes";

const AUTH_ROUTES = ["/signin", "/signup", "/forgot-password"];
const ONBOARDING_ROUTE = "/onboarding";
const LEGACY_APP_PREFIX = "/app";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has("access_token") ||
    request.cookies.has("refresh_token");

  const tenantSlug = getTenantSlugFromPath(pathname);
  const isLegacyApp = pathname.startsWith(LEGACY_APP_PREFIX);
  const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isProtected =
    tenantSlug !== null || isLegacyApp || isOnboarding;

  if (isProtected && !hasSession) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isLegacyApp && hasSession) {
    const slug = request.cookies.get("tenant_slug")?.value;
    if (slug) {
      const destination = rewriteLegacyAppPath(pathname, slug);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  if (isAuthRoute && hasSession) {
    const slug = request.cookies.get("tenant_slug")?.value;
    if (slug) {
      return NextResponse.redirect(new URL(tenantRoot(slug), request.url));
    }
    return NextResponse.redirect(new URL("/onboarding", request.url));
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
    "/((?!_next|api|favicon.ico|.*\\..*).*)",
  ],
};
