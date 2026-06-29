import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface ShoutoutCategoryRecord {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
}

export async function fetchShoutoutCategoriesAdmin(): Promise<ShoutoutCategoryRecord[]> {
  const tenantId = await resolveTenantId();
  return apiClient<ShoutoutCategoryRecord[]>(tenantPath(tenantId, 'shoutout-categories'));
}

export async function createShoutoutCategory(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<ShoutoutCategoryRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<ShoutoutCategoryRecord>(tenantPath(tenantId, 'shoutout-categories'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateShoutoutCategory(
  id: string,
  input: Partial<{ name: string; description: string; color: string; isActive: boolean }>,
): Promise<ShoutoutCategoryRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<ShoutoutCategoryRecord>(tenantPath(tenantId, `shoutout-categories/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteShoutoutCategory(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `shoutout-categories/${id}`), { method: 'DELETE' });
}
