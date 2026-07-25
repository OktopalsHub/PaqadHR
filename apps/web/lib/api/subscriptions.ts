import { apiClient } from '@/lib/api/client';
import type { BillingOverview, BillingStatus, CheckoutResponse } from '@/lib/schemas/subscription';

export async function fetchLandingPricing(): Promise<{ currency: string; countryCode: string }> {
  return apiClient('/subscriptions/landing-pricing');
}

export async function startTrial(tenantId: string, planSlug: string) {
  return apiClient(`/subscriptions/tenant/${tenantId}/start-trial`, {
    method: 'POST',
    body: JSON.stringify({ planSlug }),
  });
}

export async function fetchBillingStatus(tenantId: string): Promise<BillingStatus> {
  return apiClient<BillingStatus>(`/subscriptions/tenant/${tenantId}/billing-status`);
}

export async function fetchBillingOverview(tenantId: string): Promise<BillingOverview> {
  return apiClient<BillingOverview>(`/subscriptions/tenant/${tenantId}/billing-overview`);
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

export async function updatePaymentMethod(
  tenantId: string,
  successUrl?: string,
): Promise<{ checkoutUrl: string; id: string; reference: string }> {
  return apiClient(`/subscriptions/tenant/${tenantId}/update-payment-method`, {
    method: 'POST',
    body: JSON.stringify(successUrl ? { successUrl } : {}),
  });
}

export async function cancelSubscription(
  tenantId: string,
  options?: { atPeriodEnd?: boolean; reason?: string },
) {
  return apiClient(`/subscriptions/tenant/${tenantId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(options ?? {}),
  });
}

export async function pauseSubscription(tenantId: string) {
  return apiClient(`/subscriptions/tenant/${tenantId}/pause`, { method: 'POST' });
}

export async function resumeSubscription(tenantId: string) {
  return apiClient(`/subscriptions/tenant/${tenantId}/resume`, { method: 'POST' });
}

export interface ActivateTenantSubscriptionInput {
  planSlug?: string;
  periodMonths?: number;
  note?: string;
}

export async function activateTenantSubscription(
  tenantId: string,
  input: ActivateTenantSubscriptionInput,
) {
  return apiClient(`/admin/subscriptions/tenant/${tenantId}/activate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function extendTenantTrial(tenantId: string, additionalDays: number) {
  return apiClient(`/admin/subscriptions/tenant/${tenantId}/extend-trial`, {
    method: 'POST',
    body: JSON.stringify({ additionalDays }),
  });
}
