import type { QueryClient } from '@tanstack/react-query';
import { apiClient, tenantPath } from '@/lib/api/client';
import { cacheKeys, removeCached } from '@/lib/cache';
import { formatWorkspaceName } from '@/lib/format-name';
import { getTenantSlugFromPath } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import type { Tenant } from '@/lib/schemas/tenant';
import { paginatedTenantsSchema } from '@/lib/schemas/tenant';
import { persistTenantId, readTenantId, readTenantSlug } from '@/lib/session';

export interface CreateTenantInput {
  name: string;
  slug?: string;
}

export interface UpdateTenantInput {
  name?: string;
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

// Lazy reference to queryClient (set by QueryProvider)
let queryClientRef: QueryClient | null = null;

export function setQueryClientForTenants(client: QueryClient) {
  queryClientRef = client;
}

function getCachedTenants(): Tenant[] | undefined {
  // Try React Query cache first (instant, no HTTP)
  if (queryClientRef) {
    const cached = queryClientRef.getQueryData<Tenant[]>(queryKeys.tenants.all);
    if (cached) return cached;
  }
  return undefined;
}

function invalidateTenantCache() {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({ queryKey: queryKeys.tenants.all });
  }
  removeCached(cacheKeys.tenants.all);
}

export { invalidateTenantCache };

export async function resolveTenantId(): Promise<string> {
  const slug =
    (typeof window !== 'undefined' ? getTenantSlugFromPath(window.location.pathname) : null) ??
    readTenantSlug();

  // Use React Query cache first (instant, no HTTP)
  let tenants = getCachedTenants();

  // If not cached, use queryClient.fetchQuery which deduplicates concurrent calls
  // instead of raw HTTP which causes N parallel requests
  if (!tenants && queryClientRef) {
    try {
      tenants = await queryClientRef.fetchQuery<Tenant[]>({
        queryKey: queryKeys.tenants.all,
        queryFn: fetchUserTenants,
        staleTime: 60_000,
      });
    } catch {
      tenants = undefined;
    }
  }

  // Last resort: direct HTTP
  if (!tenants) {
    tenants = await fetchUserTenants();
  }

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
