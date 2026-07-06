import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9001').replace(/\/$/, '');

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://cdn.reloadly.com",
    `connect-src 'self' ${apiOrigin} https://challenges.cloudflare.com`,
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-nonce', nonce);
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  const slug = request.cookies.get('tenant_slug')?.value;
  if (slug && request.nextUrl.pathname.startsWith('/app')) {
    const destination = rewriteLegacyAppPath(request.nextUrl.pathname, slug);
    if (destination !== request.nextUrl.pathname) {
      const redirect = NextResponse.redirect(new URL(destination, request.url));
      applySecurityHeaders(redirect, nonce);
      return redirect;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(response, nonce);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
