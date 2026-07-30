import { apiClient, tenantPath } from '@/lib/api/client';
import { formatWorkspaceName } from '@/lib/format-name';
import { getTenantSlugFromPath } from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';
import { paginatedTenantsSchema } from '@/lib/schemas/tenant';
import { persistTenantId, readTenantId, readTenantSlug } from '@/lib/session';

export interface CreateTenantInput {
  name: string;
  slug?: string;
}

export interface UpdateTenantInput {
  name?: string;
  countryCode?: string;
  timezone?: string;
  preferredCurrency?: string;
  logoKey?: string;
  employeeCode?: string;
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return apiClient<Tenant>('/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTenant(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
  return apiClient<Tenant>(`/tenants/${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchUserTenants() {
  const data = await apiClient<unknown>('/tenants/user/me?limit=50');
  const parsed = paginatedTenantsSchema.parse(data);
  return parsed.records.map((tenant) => ({
    ...tenant,
    name: formatWorkspaceName(tenant.name),
  }));
}

export async function resolveTenantId(): Promise<string> {
  const slug =
    (typeof window !== 'undefined' ? getTenantSlugFromPath(window.location.pathname) : null) ??
    readTenantSlug();

  const tenants = await fetchUserTenants();

  if (slug) {
    const fromSlug = tenants.find((t) => t.slug === slug);
    if (fromSlug) {
      persistTenantId(fromSlug.id);
      return fromSlug.id;
    }
  }

  const stored = readTenantId();
  if (stored && tenants.some((t) => t.id === stored)) {
    return stored;
  }

  const active = tenants.find((t) => t.isActive) ?? tenants[0];

  if (!active) {
    throw new Error('No tenant found for this account');
  }

  persistTenantId(active.id);
  return active.id;
}

export function getTenantApiPath(tenantId: string, path: string) {
  return tenantPath(tenantId, path);
}

export async function getTenantBySlug(slug: string): Promise<Tenant> {
  return apiClient<Tenant>(`/tenants/slug/${slug}`, {
    method: 'GET',
    skipCsrf: true,
  });
}
