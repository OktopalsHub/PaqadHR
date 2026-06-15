import { apiClient } from '@/lib/api/client';
import type { BillingStatus } from '@/lib/schemas/subscription';

export async function fetchBillingStatus(tenantId: string): Promise<BillingStatus> {
  return apiClient<BillingStatus>(`/subscriptions/tenant/${tenantId}/billing-status`);
}

export async function fetchTenantSubscription(tenantId: string) {
  return apiClient(`/subscriptions/tenant/${tenantId}`);
}
