import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getTenantSlugFromHost,
  getTenantSlugFromPath,
  isApexHost,
  isMarketingAuthPath,
  isSubdomainTenantsEnabled,
  marketingOriginFromHost,
  rewriteLegacyAppPath,
  tenantUrl,
} from '@/lib/navigation/tenant-routes';
import { buildContentSecurityPolicy } from './lib/security/content-security-policy';
import { CSP_NONCE_HEADER } from './lib/security/csp-nonce';

function createRequestWithNonce(request: NextRequest, nonce: string): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  return requestHeaders;
}

function applySecurityHeaders(response: NextResponse, requestHost: string, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(requestHost, nonce));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const requestHeaders = createRequestWithNonce(request, nonce);
  const requestHost = request.nextUrl.hostname;
  const hostHeader = request.headers.get('host') ?? requestHost;
  const pathname = request.nextUrl.pathname;

  const slug = request.cookies.get('tenant_slug')?.value;
  if (slug && pathname.startsWith('/app')) {
    const destination = rewriteLegacyAppPath(pathname, slug);
    if (destination !== pathname) {
      const redirect = NextResponse.redirect(new URL(destination, request.url));
      applySecurityHeaders(redirect, requestHost, nonce);
      return redirect;
    }
  }

  if (isSubdomainTenantsEnabled()) {
    const slugFromHost = getTenantSlugFromHost(hostHeader);

    if (slugFromHost) {
      if (isMarketingAuthPath(pathname)) {
        const apexOrigin = marketingOriginFromHost(hostHeader);
        const destination = new URL(`${pathname}${request.nextUrl.search}`, apexOrigin);
        const redirect = NextResponse.redirect(destination);
        applySecurityHeaders(redirect, requestHost, nonce);
        return redirect;
      }

      const alreadyPrefixed =
        pathname === `/${slugFromHost}` || pathname.startsWith(`/${slugFromHost}/`);
      if (!alreadyPrefixed) {
        const internalPath = pathname === '/' ? `/${slugFromHost}` : `/${slugFromHost}${pathname}`;
        const rewrite = NextResponse.rewrite(new URL(internalPath, request.url), {
          request: { headers: requestHeaders },
        });
        applySecurityHeaders(rewrite, requestHost, nonce);
        return rewrite;
      }
    } else if (isApexHost(hostHeader)) {
      const legacySlug = getTenantSlugFromPath(pathname);
      if (legacySlug) {
        const rest = pathname.slice(`/${legacySlug}`.length) || '/';
        const destination = tenantUrl(legacySlug, rest);
        const redirect = NextResponse.redirect(destination, 301);
        applySecurityHeaders(redirect, requestHost, nonce);
        return redirect;
      }
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response, requestHost, nonce);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
