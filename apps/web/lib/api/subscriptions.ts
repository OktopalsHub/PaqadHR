import { apiClient } from '@/lib/api/client';
import type { BillingOverview, BillingStatus, CheckoutResponse } from '@/lib/schemas/subscription';

export async function fetchBillingStatus(tenantId: string): Promise<BillingStatus> {
  return apiClient<BillingStatus>(`/subscriptions/tenant/${tenantId}/billing-status`);
}

export async function fetchBillingOverview(tenantId: string): Promise<BillingOverview> {
  return apiClient<BillingOverview>(`/subscriptions/tenant/${tenantId}/billing-overview`);
}

export async function fetchTenantSubscription(tenantId: string) {
  return apiClient(`/subscriptions/tenant/${tenantId}`);
}

export async function createSubscriptionCheckout(
  tenantId: string,
  planSlug: string,
  successUrl?: string,
): Promise<CheckoutResponse> {
  return apiClient<CheckoutResponse>(`/subscriptions/tenant/${tenantId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      planSlug,
      ...(successUrl ? { successUrl } : {}),
    }),
  });
}
