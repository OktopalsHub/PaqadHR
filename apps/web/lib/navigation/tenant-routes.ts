import {
  isReservedTenantSlug,
  RESERVED_HOST_SUBDOMAINS,
  RESERVED_ROUTE_SEGMENTS,
  RESERVED_TENANT_SLUG_LIST,
  RESERVED_TENANT_SLUGS,
} from '@/lib/constants/reserved-tenant-slugs';
import type { Tenant } from '@/lib/schemas/tenant';

export {
  isReservedTenantSlug,
  RESERVED_HOST_SUBDOMAINS,
  RESERVED_ROUTE_SEGMENTS,
  RESERVED_TENANT_SLUG_LIST,
  RESERVED_TENANT_SLUGS,
};

export function isSubdomainTenantsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS === 'true';
}

export function getAppDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || 'paqadhr.com';
}

// Tenant slugs are used as DNS labels when subdomain routing is enabled. Keep
// this aligned with the onboarding slug format and never build a host from an
// arbitrary route parameter.
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TENANT_SLUG_MAX_LENGTH = 63;

export function isValidTenantSlug(slug: string): boolean {
  return slug.length <= TENANT_SLUG_MAX_LENGTH && TENANT_SLUG_PATTERN.test(slug);
}

function stripPort(host: string): string {
  return host.split(':')[0].toLowerCase();
}

export function getTenantSlugFromHost(host: string): string | null {
  const hostname = stripPort(host);

  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, -'.localhost'.length);
    if (isValidTenantSlug(sub) && !RESERVED_HOST_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  const appDomain = getAppDomain();

  if (
    hostname === appDomain ||
    hostname === `www.${appDomain}` ||
    hostname === `dev.${appDomain}`
  ) {
    return null;
  }

  const devSuffix = `.dev.${appDomain}`;
  if (hostname.endsWith(devSuffix)) {
    const sub = hostname.slice(0, -devSuffix.length);
    if (isValidTenantSlug(sub) && !RESERVED_HOST_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  const prodSuffix = `.${appDomain}`;
  if (hostname.endsWith(prodSuffix)) {
    const sub = hostname.slice(0, -prodSuffix.length);
    if (isValidTenantSlug(sub) && !RESERVED_HOST_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  return null;
}

export function isApexHost(host: string): boolean {
  return getTenantSlugFromHost(host) === null;
}

function inferTenantHostSuffix(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const appDomain = getAppDomain();
    if (hostname.endsWith('.localhost') || hostname === 'localhost') {
      const port = window.location.port;
      return `.localhost${port ? `:${port}` : ''}`;
    }
    if (hostname === `dev.${appDomain}` || hostname.endsWith(`.dev.${appDomain}`)) {
      return `.dev.${appDomain}`;
    }
    return `.${appDomain}`;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const appDomain = getAppDomain();
      if (url.hostname === `dev.${appDomain}` || url.hostname.endsWith(`.dev.${appDomain}`)) {
        return `.dev.${appDomain}`;
      }
      if (url.hostname.endsWith('.localhost') || url.hostname === 'localhost') {
        return `.localhost${url.port ? `:${url.port}` : ''}`;
      }
    } catch {
      // fall through
    }
  }

  return `.${getAppDomain()}`;
}

export function buildTenantHost(slug: string, hostSuffix?: string): string {
  if (!isValidTenantSlug(slug)) {
    throw new Error('Invalid tenant slug');
  }
  if (isReservedTenantSlug(slug)) {
    throw new Error('Reserved tenant slug');
  }

  const suffix = hostSuffix ?? inferTenantHostSuffix();
  return `${slug}${suffix}`;
}

export function isOnTenantSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return getTenantSlugFromHost(window.location.host) !== null;
}

export function tenantOrigin(slug: string): string {
  if (!isSubdomainTenantsEnabled()) {
    if (typeof window !== 'undefined') return window.location.origin;
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');
    return 'http://localhost:3000';
  }

  const protocol =
    typeof window !== 'undefined' ? window.location.protocol.replace(/:$/, '') : 'https';
  return `${protocol}://${buildTenantHost(slug)}`;
}

export function tenantUrl(slug: string, path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (isSubdomainTenantsEnabled()) {
    const origin = tenantOrigin(slug);
    return normalized === '/' ? `${origin}/` : `${origin}${normalized}`;
  }

  const origin = tenantOrigin(slug);
  if (normalized === '/') return `${origin}/${slug}`;
  return `${origin}/${slug}${normalized}`;
}

export function tenantRoot(slug: string): string {
  if (isSubdomainTenantsEnabled()) {
    if (typeof window !== 'undefined' && isOnTenantSubdomain()) return '/';
    return tenantUrl(slug, '/');
  }
  return `/${slug}`;
}

export function tenantPath(slug: string, segment?: string): string {
  if (isSubdomainTenantsEnabled() && (typeof window === 'undefined' || !isOnTenantSubdomain())) {
    const clean = segment?.replace(/^\//, '');
    return tenantUrl(slug, clean ? `/${clean}` : '/');
  }

  const root = tenantRoot(slug);
  if (!segment) return root === '/' ? '/' : root;
  const clean = segment.replace(/^\//, '');
  return root === '/' ? `/${clean}` : `${root}/${clean}`;
}

/** Strip internal /[slug] prefix when middleware rewrites tenant subdomain routes. */
export function tenantSubpathFromPathname(pathname: string, slug: string): string {
  if (!isOnTenantSubdomain()) return pathname;
  const stripped = pathname.replace(new RegExp(`^/${slug}(?=/|$)`), '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function goToTenantPath(
  slug: string,
  navigate: (href: string) => void,
  segment?: string,
): void {
  const href = segment ? tenantPath(slug, segment) : tenantRoot(slug);
  if (href.startsWith('http://') || href.startsWith('https://')) {
    window.location.assign(href);
    return;
  }
  navigate(href);
}

export function rewriteLegacyAppPath(path: string, slug: string): string {
  if (path === '/app' || path === '/app/') return tenantRoot(slug);
  if (path.startsWith('/app/')) {
    return tenantPath(slug, path.slice('/app/'.length));
  }
  return path;
}

export function getTenantSlugFromPath(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment || RESERVED_ROUTE_SEGMENTS.has(segment) || !isValidTenantSlug(segment)) return null;
  return segment;
}

function resolveTenantSubpath(slug: string, redirect: string): string {
  if (redirect.startsWith(`/${slug}`)) {
    return redirect.slice(`/${slug}`.length) || '/';
  }
  if (redirect.startsWith('/app')) {
    const rewritten = rewriteLegacyAppPath(redirect, slug);
    if (rewritten.startsWith(`/${slug}`)) {
      return rewritten.slice(`/${slug}`.length) || '/';
    }
    return rewritten;
  }
  return redirect;
}

function isAllowedAuthRedirect(redirect: string): boolean {
  if (redirect.startsWith('/')) return true;
  try {
    const parsed = new URL(redirect);
    const appDomain = getAppDomain();
    const host = parsed.hostname.toLowerCase();
    if (host === appDomain || host === `www.${appDomain}` || host === `dev.${appDomain}`) {
      return true;
    }
    if (host.endsWith(`.dev.${appDomain}`) || host.endsWith(`.${appDomain}`)) {
      return true;
    }
    if (host.endsWith('.localhost') || host === 'localhost') return true;
    return false;
  } catch {
    return false;
  }
}

export function getPostAuthPath(tenants: Tenant[], redirect?: string | null): string {
  if (tenants.length === 0) return '/onboarding';

  const tenant = tenants.find((item) => item.isActive) ?? tenants[0];
  if (!tenant.slug) return '/onboarding';

  if (redirect) {
    if (redirect.startsWith('/onboarding')) {
      return isSubdomainTenantsEnabled() ? tenantUrl(tenant.slug, '/') : tenantRoot(tenant.slug);
    }
    if (redirect.startsWith(`/${tenant.slug}`) || redirect.startsWith('/app')) {
      if (isSubdomainTenantsEnabled()) {
        return tenantUrl(tenant.slug, resolveTenantSubpath(tenant.slug, redirect));
      }
      if (redirect.startsWith(`/${tenant.slug}`)) return redirect;
      return rewriteLegacyAppPath(redirect, tenant.slug);
    }
    if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
      return isAllowedAuthRedirect(redirect) ? redirect : tenantUrl(tenant.slug, '/');
    }
    if (isSubdomainTenantsEnabled() && redirect.startsWith('/')) {
      return tenantUrl(tenant.slug, redirect);
    }
  }

  return isSubdomainTenantsEnabled() ? tenantUrl(tenant.slug, '/') : tenantRoot(tenant.slug);
}

export function tenantHostPreview(slug: string): string {
  if (isSubdomainTenantsEnabled()) {
    return buildTenantHost(slug);
  }
  const base = typeof window !== 'undefined' ? window.location.host : getAppDomain();
  return `${base}/${slug}`;
}

export function getWorkspaceUrlPrefix(): string {
  if (isSubdomainTenantsEnabled()) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}//`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.endsWith('/') ? configured : `${configured}/`;
  }
  return 'http://localhost:3000/';
}

export function getWorkspaceUrlSuffix(): string {
  if (!isSubdomainTenantsEnabled()) return '';
  return inferTenantHostSuffix();
}

export function marketingOriginFromHost(host: string): string {
  const hostname = stripPort(host);
  const appDomain = getAppDomain();

  if (hostname === 'localhost') {
    const port = host.includes(':') ? host.split(':')[1] : '3000';
    return `http://localhost:${port}`;
  }

  if (hostname.endsWith('.localhost')) {
    const port = host.includes(':') ? host.split(':')[1] : '';
    return `http://${hostname}${port ? `:${port}` : ''}`;
  }

  if (hostname === `dev.${appDomain}` || hostname.endsWith(`.dev.${appDomain}`)) {
    return `https://dev.${appDomain}`;
  }

  if (hostname === appDomain || hostname === `www.${appDomain}`) {
    return `https://${hostname}`;
  }

  if (hostname.endsWith(`.${appDomain}`)) {
    return `https://${appDomain}`;
  }

  return `https://${appDomain}`;
}

export function marketingOrigin(): string {
  if (typeof window !== 'undefined') {
    if (isApexHost(window.location.host)) {
      return window.location.origin;
    }
    return marketingOriginFromHost(window.location.host);
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }

  return marketingOriginFromHost(getAppDomain());
}

export const MARKETING_AUTH_SEGMENTS = new Set([
  'signin',
  'signup',
  'onboarding',
  'subscribe',
  'reset-password',
  'accept-invite',
  'privacy',
  'terms',
  'google',
]);

export function isMarketingAuthPath(pathname: string): boolean {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? MARKETING_AUTH_SEGMENTS.has(segment) : false;
}

export function authPageUrl(
  path: '/signin' | '/signup' | '/onboarding',
  returnTo?: string,
): string {
  const origin = marketingOrigin();
  if (!returnTo) return `${origin}${path}`;
  return `${origin}${path}?redirect=${encodeURIComponent(returnTo)}`;
}

export function captureAuthReturnTo(pathname?: string): string {
  if (typeof window === 'undefined') return pathname ?? '/';
  if (isOnTenantSubdomain()) return window.location.href;
  const path = pathname ?? window.location.pathname;
  const search = window.location.search;
  return `${path}${search}`;
}

export type SubscribePageParams = {
  welcome?: boolean;
  billing?: boolean;
  workspace?: string;
};

export function subscribePagePath(params?: SubscribePageParams): string {
  const search = new URLSearchParams();
  if (params?.welcome) search.set('welcome', '1');
  if (params?.billing) search.set('billing', 'success');
  if (params?.workspace) search.set('workspace', params.workspace);
  const query = search.toString();
  return `/subscribe${query ? `?${query}` : ''}`;
}

export function subscribePageUrl(params?: SubscribePageParams): string {
  return `${marketingOrigin()}${subscribePagePath(params)}`;
}
