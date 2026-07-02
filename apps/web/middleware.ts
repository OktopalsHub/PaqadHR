import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';

// Auth gating lives in the client route guards (AppGate/TenantSlugGate/
// OnboardingGate) and the API — not here. The session token lives in
// localStorage, which middleware cannot read, so it can't be the auth gate.
// This only rewrites legacy /app/* URLs to the tenant-scoped path.
export function middleware(request: NextRequest) {
  const slug = request.cookies.get('tenant_slug')?.value;
  if (slug) {
    const destination = rewriteLegacyAppPath(request.nextUrl.pathname, slug);
    // Guard against a self-redirect loop if the slug is itself "app".
    if (destination !== request.nextUrl.pathname) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
