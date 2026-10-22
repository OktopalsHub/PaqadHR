import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { normalizeApiV1Base, resolveApiBaseUrl } from '@/lib/api-origin';
import {
  getTenantSlugFromHost,
  getTenantSlugFromPath,
  isApexHost,
  isMarketingAuthPath,
  isReservedTenantSlug,
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

const STATIC_FILE_PATHS = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/version.json',
  '/icon.png',
  '/favicon.ico',
  '/opengraph-image',
  '/.well-known/ai-catalog.json',
  '/.well-known/security.txt',
]);

const FILE_LIKE_PATH = /\.[a-z0-9]{2,12}$/i;

/**
 * Metadata files and app icons are served once for the whole deployment, so
 * they must never be treated as a tenant slug or rewritten under one.
 */
function isStaticAssetPath(pathname: string): boolean {
  return STATIC_FILE_PATHS.has(pathname) || FILE_LIKE_PATH.test(pathname);
}

/**
 * True for requests that are clearly assets (not pages) but have no route or
 * public file behind them. Without this, `/[tenantSlug]` consumes `/photo.png`
 * and returns the app shell with a 200 status.
 */
function isUnknownStaticFile(pathname: string): boolean {
  return FILE_LIKE_PATH.test(pathname) && !STATIC_FILE_PATHS.has(pathname);
}

/**
 * Plain 404 for paths that are neither a page nor a tenant. Unknown single
 * segment paths used to fall through to `/[tenantSlug]`, which answers 200 with
 * an empty app shell (a soft 404 crawlers will happily index).
 */
function notFoundResponse(
  requestHost: string,
  nonce: string,
  extra?: Record<string, string>,
): NextResponse {
  const response = new NextResponse('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...extra },
  });
  applySecurityHeaders(response, requestHost, nonce);
  return response;
}

/**
 * Whether a workspace slug exists.
 *
 * `true`/`false` when the API answered, `null` when it could not be reached.
 * An address that does not exist must not be answered with a page that behaves
 * like a real workspace, but an API outage must never take a real workspace
 * offline — so an unknown answer is treated as "assume it exists".
 */
async function workspaceExists(slug: string, requestHost: string): Promise<boolean | null> {
  const apiBase = normalizeApiV1Base(resolveApiBaseUrl({ requestHost }));
  try {
    const response = await fetch(`${apiBase}/tenants/slug/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    if (response.status === 404) return false;
    if (response.ok) return true;
    return null;
  } catch {
    return null;
  }
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

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const requestHost = request.nextUrl.hostname;
  const hostHeader = request.headers.get('host') ?? requestHost;
  const pathname = request.nextUrl.pathname;

  // The matcher now includes file-like paths so a missing asset cannot fall
  // through to the tenant dynamic segment and render the app shell as a 200.
  if (isUnknownStaticFile(pathname)) {
    return notFoundResponse(requestHost, nonce);
  }

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
      const isTenantAgnosticFile = isStaticAssetPath(pathname) || pathname === '/version.json';
      if (!alreadyPrefixed && !isTenantAgnosticFile) {
        const internalPath = pathname === '/' ? `/${slugFromHost}` : `/${slugFromHost}${pathname}`;
        const rewriteHeaders = createRenderRequestHeaders(request, requestHost, nonce);
        const rewrite = NextResponse.rewrite(new URL(internalPath, request.url), {
          request: { headers: rewriteHeaders },
        });
        // A subdomain with no tenant still renders the workspace shell. Keep those
        // addresses out of the index even when the rendered page metadata is stale.
        rewrite.headers.set('X-Robots-Tag', 'noindex, nofollow');
        applySecurityHeaders(rewrite, requestHost, nonce);
        return rewrite;
      }
    } else if (isApexHost(hostHeader) && !isStaticAssetPath(pathname)) {
      const legacySlug = getTenantSlugFromPath(pathname);
      if (legacySlug) {
        // A reserved slug can never be a tenant: tenantUrl() -> buildTenantHost()
        // throws "Reserved tenant slug", which surfaced as a 500 for /about,
        // /blog, /careers, /security, /company, /legal, /recruitment and /payroll.
        // Those addresses are not pages either, so answer 404 instead of a 5xx.
        if (isReservedTenantSlug(legacySlug)) {
          return notFoundResponse(requestHost, nonce, { 'X-Robots-Tag': 'noindex, nofollow' });
        }
        // A slug that was never a tenant must answer 404 instead of being sent to a
        // workspace host that renders an empty app shell with a 200 status.
        const exists = await workspaceExists(legacySlug, requestHost);
        if (exists === false) {
          return notFoundResponse(requestHost, nonce, { 'X-Robots-Tag': 'noindex, nofollow' });
        }
        const rest = pathname.slice(`/${legacySlug}`.length) || '/';
        const destination = tenantUrl(legacySlug, rest);
        const redirect = NextResponse.redirect(destination, 301);
        // Browsers cache permanent redirects aggressively; keep this one
        // revalidatable so a routing fix never strands anyone on a stale 301.
        redirect.headers.set('Cache-Control', 'no-store');
        // Paths that were never tenants land on an empty workspace shell; keep the
        // redirect discoverable but out of the index.
        redirect.headers.set('X-Robots-Tag', 'noindex, nofollow');
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
