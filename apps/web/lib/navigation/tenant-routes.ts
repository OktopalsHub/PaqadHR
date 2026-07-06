import type { Tenant } from '@/lib/schemas/tenant';

export const RESERVED_ROUTE_SEGMENTS = new Set([
  'signin',
  'signup',
  'accept-invite',
  'forgot-password',
  'reset-password',
  'onboarding',
  'app',
  'api',
  '_next',
]);

export function tenantRoot(slug: string) {
  return `/${slug}`;
}

export function tenantPath(slug: string, segment?: string) {
  if (!segment) return tenantRoot(slug);
  const clean = segment.replace(/^\//, '');
  return `${tenantRoot(slug)}/${clean}`;
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
  if (!segment || RESERVED_ROUTE_SEGMENTS.has(segment)) return null;
  return segment;
}

export function getPostAuthPath(tenants: Tenant[], redirect?: string | null): string {
  if (tenants.length === 0) return '/onboarding';

  const tenant = tenants.find((item) => item.isActive) ?? tenants[0];
  if (!tenant.slug) return '/onboarding';

  if (redirect) {
    if (redirect.startsWith('/onboarding')) return tenantRoot(tenant.slug);
    if (redirect.startsWith(`/${tenant.slug}`)) return redirect;
    if (redirect.startsWith('/app')) {
      return rewriteLegacyAppPath(redirect, tenant.slug);
    }
  }

  return tenantRoot(tenant.slug);
}
