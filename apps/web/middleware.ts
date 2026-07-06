import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { BRAND_ORIGIN } from '@/lib/brand';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9001')
  .replace(/\/$/, '')
  .replace(/\/api\/v1$/, '')
  .replace(/\/api$/, '');
const r2PublicOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');

function buildContentSecurityPolicy(): string {
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

  const connectSources = ["'self'", apiOrigin, 'https://challenges.cloudflare.com'];

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
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

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function middleware(request: NextRequest) {
  const slug = request.cookies.get('tenant_slug')?.value;
  if (slug && request.nextUrl.pathname.startsWith('/app')) {
    const destination = rewriteLegacyAppPath(request.nextUrl.pathname, slug);
    if (destination !== request.nextUrl.pathname) {
      const redirect = NextResponse.redirect(new URL(destination, request.url));
      applySecurityHeaders(redirect);
      return redirect;
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
