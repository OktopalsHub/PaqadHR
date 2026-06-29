import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type ApiAddress = {
  id: string;
  street?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
  country: string;
};

export type UpsertAddressInput = {
  street?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
};

export async function fetchMemberAddress(memberId: string): Promise<ApiAddress | null> {
  const tenantId = await resolveTenantId();
  try {
    return await apiClient<ApiAddress | null>(tenantPath(tenantId, `members/${memberId}/address`));
  } catch {
    return null;
  }
}

export async function upsertMemberAddress(
  memberId: string,
  input: UpsertAddressInput,
): Promise<ApiAddress> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiAddress>(tenantPath(tenantId, `members/${memberId}/address`), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
