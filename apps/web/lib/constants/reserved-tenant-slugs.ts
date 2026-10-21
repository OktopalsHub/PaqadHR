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
  'contact',
  'cookies',
  'dpa',
  'app',
  'api',
  '_next',
  'pricing',
  // Public marketing pages. These are also reserved tenant slugs, so without an
  // entry here the middleware answers them with a 404 before Next can route them.
  'about',
  'security',
  'payroll',
  'employee-recognition',
  'hr-software',
  'hr',
  // Discovery endpoints live under a dot-prefixed directory; without an entry here
  // the middleware would try to resolve them as a tenant slug.
  '.well-known',
  // OAuth completion lives at /google/complete — without this the legacy
  // path→subdomain redirect sends the browser to google.<appdomain>, which has
  // no certificate (ERR_CERT_AUTHORITY_INVALID) and breaks Google sign-in.
  'google',
]);

/** Reserved subdomain labels (tenant slugs + infra hosts). */
export const RESERVED_HOST_SUBDOMAINS = new Set([...RESERVED_TENANT_SLUGS, 'dev']);

export function isReservedTenantSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;
  return RESERVED_TENANT_SLUGS.has(normalized);
}
