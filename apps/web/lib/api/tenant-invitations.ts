import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type TenantInvitation = {
  id: string;
  email: string;
  tenantId: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  status: string;
  departmentId?: string;
  positionId?: string;
  invitedBy: string;
  expiresAt: string;
  tenantName?: string;
  tenantSlug?: string;
};

export async function fetchTenantInvitations(status?: string): Promise<TenantInvitation[]> {
  const tenantId = await resolveTenantId();
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiClient<TenantInvitation[]>(tenantPath(tenantId, `invites${query}`));
  return Array.isArray(data) ? data : [];
}

export async function resendTenantInvitation(invitationId: string): Promise<TenantInvitation> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantInvitation>(tenantPath(tenantId, `invites/${invitationId}/resend`), {
    method: 'POST',
  });
}

export async function revokeTenantInvitation(invitationId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `invites/${invitationId}`), {
    method: 'DELETE',
  });
}
