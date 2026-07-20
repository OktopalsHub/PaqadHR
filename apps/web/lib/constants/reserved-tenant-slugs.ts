import reservedTenantSlugList from '../../../../constants/reserved-tenant-slugs.json';

export const RESERVED_TENANT_SLUG_LIST = [...reservedTenantSlugList] as readonly string[];

export const RESERVED_TENANT_SLUGS = new Set(
  RESERVED_TENANT_SLUG_LIST.map((slug) => slug.toLowerCase()),
);

/** Reserved app routes — subset used by middleware path parsing. */
export const RESERVED_ROUTE_SEGMENTS = new Set([
  'signin',
  'signup',
  'accept-invite',
  'accept-invitation',
  'forgot-password',
  'reset-password',
  'onboarding',
  'subscribe',
  'privacy',
  'terms',
  'app',
  'api',
  '_next',
]);

/** Reserved subdomain labels (tenant slugs + infra hosts). */
export const RESERVED_HOST_SUBDOMAINS = new Set([...RESERVED_TENANT_SLUGS, 'dev']);

export function isReservedTenantSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;
  return RESERVED_TENANT_SLUGS.has(normalized);
}
