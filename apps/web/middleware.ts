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

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function createRenderRequestHeaders(
  request: NextRequest,
  requestHost: string,
  nonce: string,
): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set('Content-Security-Policy', buildContentSecurityPolicy(requestHost, nonce));
  return requestHeaders;
}

function applySecurityHeaders(response: NextResponse, requestHost: string, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(requestHost, nonce));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Great HSTS — 2 years with preload, per SECURITY.md and OWASP
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // Great hardening headers (OWASP Secure Headers)
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Origin-Agent-Cluster', '?1');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), fullscreen=(self)',
  );
  response.headers.set('X-XSS-Protection', '0'); // Modern CSP nonce replaces XSS filter
  // Remove powered-by
  response.headers.delete('x-powered-by');
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
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
        const rewriteHeaders = createRenderRequestHeaders(request, requestHost, nonce);
        const rewrite = NextResponse.rewrite(new URL(internalPath, request.url), {
          request: { headers: rewriteHeaders },
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

  const response = NextResponse.next({
    request: { headers: createRenderRequestHeaders(request, requestHost, nonce) },
  });
  applySecurityHeaders(response, requestHost, nonce);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
