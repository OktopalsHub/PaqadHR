import { apiClient, tenantPath } from '@/lib/api/client';
import { paginatedTenantsSchema } from '@/lib/schemas/tenant';
import { persistTenantId, readTenantId } from '@/lib/session';

export async function fetchUserTenants() {
  const data = await apiClient<unknown>('/tenants/user/me?limit=50');
  const parsed = paginatedTenantsSchema.parse(data);
  return parsed.records;
}

export async function resolveTenantId(): Promise<string> {
  const stored = readTenantId();
  if (stored) return stored;

  const tenants = await fetchUserTenants();
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
