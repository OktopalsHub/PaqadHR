import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface LeavePolicy {
  id: string;
  tenantId: string;
  allowCarryover: boolean;
  maxCarryoverDays: number;
  carryoverExpiryMonths: number | null;
  autoCreateAnnualBalances: boolean;
  prorateForNewJoiners: boolean;
}

export async function fetchLeavePolicy(): Promise<LeavePolicy> {
  const tenantId = await resolveTenantId();
  return apiClient<LeavePolicy>(tenantPath(tenantId, 'leave-policies'));
}

export async function updateLeavePolicy(
  patch: Partial<
    Pick<
      LeavePolicy,
      | 'allowCarryover'
      | 'maxCarryoverDays'
      | 'carryoverExpiryMonths'
      | 'autoCreateAnnualBalances'
      | 'prorateForNewJoiners'
    >
  >,
): Promise<LeavePolicy> {
  const tenantId = await resolveTenantId();
  return apiClient<LeavePolicy>(tenantPath(tenantId, 'leave-policies'), {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}
