import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type ApiEmergencyContact = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  relationship: string;
  address?: string;
  isPrimary: boolean;
  tenantMemberId: string;
};

export type CreateEmergencyContactInput = {
  memberId: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  relationship: string;
  address?: string;
  isPrimary?: boolean;
};

export async function fetchEmergencyContacts(memberId: string): Promise<ApiEmergencyContact[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ApiEmergencyContact[]>(
    `${tenantPath(tenantId, 'emergency-contacts')}?memberId=${memberId}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createEmergencyContact(
  input: CreateEmergencyContactInput,
): Promise<ApiEmergencyContact> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiEmergencyContact>(tenantPath(tenantId, 'emergency-contacts'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `emergency-contacts/${id}`), {
    method: 'DELETE',
  });
}
