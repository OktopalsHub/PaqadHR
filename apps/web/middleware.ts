import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiOriginFromBase, resolveApiBaseUrl } from '@/lib/api-origin';
import { BRAND_ORIGIN } from '@/lib/brand';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';

const r2PublicOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');

function buildContentSecurityPolicy(requestHost?: string): string {
  const apiOrigin = apiOriginFromBase(resolveApiBaseUrl({ requestHost }));
  const imageSources = [
    "'self'",
    'data:',
    'blob:',
    BRAND_ORIGIN,
    'https://images.unsplash.com',
    'https://cdn.reloadly.com',
    'https://*.r2.dev',
  ];
  if (r2PublicOrigin) {
    imageSources.push(r2PublicOrigin);
  }

  const connectSources = [
    "'self'",
    apiOrigin,
    'https://challenges.cloudflare.com',
    'https://cloudflareinsights.com',
    'https://*.r2.cloudflarestorage.com',
    'https://*.r2.dev',
  ];
  if (r2PublicOrigin) {
    connectSources.push(r2PublicOrigin);
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src ${imageSources.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, requestHost?: string): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(requestHost));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function middleware(request: NextRequest) {
  const requestHost = request.nextUrl.hostname;
  const slug = request.cookies.get('tenant_slug')?.value;
  if (slug && request.nextUrl.pathname.startsWith('/app')) {
    const destination = rewriteLegacyAppPath(request.nextUrl.pathname, slug);
    if (destination !== request.nextUrl.pathname) {
      const redirect = NextResponse.redirect(new URL(destination, request.url));
      applySecurityHeaders(redirect, requestHost);
      return redirect;
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, requestHost);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
