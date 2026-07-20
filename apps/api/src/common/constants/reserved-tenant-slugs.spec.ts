import {
  isReservedTenantSlug,
  RESERVED_TENANT_SLUG_LIST,
  RESERVED_TENANT_SLUGS,
} from './reserved-tenant-slugs';

describe('reserved-tenant-slugs', () => {
  const originalTenantExcluded = process.env.TENANT_EXCLUDED_SUBDOMAINS;
  const originalExcluded = process.env.EXCLUDED_SUBDOMAINS;

  afterEach(() => {
    if (originalTenantExcluded === undefined) {
      delete process.env.TENANT_EXCLUDED_SUBDOMAINS;
    } else {
      process.env.TENANT_EXCLUDED_SUBDOMAINS = originalTenantExcluded;
    }
    if (originalExcluded === undefined) {
      delete process.env.EXCLUDED_SUBDOMAINS;
    } else {
      process.env.EXCLUDED_SUBDOMAINS = originalExcluded;
    }
  });

  it('includes a broad built-in reserved list', () => {
    expect(RESERVED_TENANT_SLUG_LIST.length).toBeGreaterThan(100);
    expect(RESERVED_TENANT_SLUGS.has('admin')).toBe(true);
    expect(RESERVED_TENANT_SLUGS.has('api')).toBe(true);
    expect(RESERVED_TENANT_SLUGS.has('www')).toBe(true);
    expect(RESERVED_TENANT_SLUGS.has('support')).toBe(true);
  });

  it('normalizes slug casing and whitespace', () => {
    expect(isReservedTenantSlug(' Admin ')).toBe(true);
    expect(isReservedTenantSlug('acme-corp')).toBe(false);
  });

  it('treats empty slugs as reserved', () => {
    expect(isReservedTenantSlug('')).toBe(true);
    expect(isReservedTenantSlug('   ')).toBe(true);
  });
});
