import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type {
  CreatePaymentMethodInput,
  PaymentMethodSummary,
  supportedCurrenciesSchema,
} from '@/lib/schemas/payment-method';
import type { z } from 'zod';

export async function fetchPaymentMethods(): Promise<PaymentMethodSummary[]> {
  const tenantId = await resolveTenantId();
  return apiClient<PaymentMethodSummary[]>(tenantPath(tenantId, 'payment-methods'));
}

export async function fetchSupportedPaymentCurrencies(): Promise<
  z.infer<typeof supportedCurrenciesSchema>
> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'payment-methods/supported/currencies'));
}

export async function createPaymentMethod(
  input: CreatePaymentMethodInput,
): Promise<PaymentMethodSummary> {
  const tenantId = await resolveTenantId();
  return apiClient<PaymentMethodSummary>(tenantPath(tenantId, 'payment-methods'), {
    method: 'POST',
    body: JSON.stringify({ ...input, type: 'BANK', isPrimary: input.isPrimary ?? true }),
  });
}

export interface PendingPaymentMethod {
  id: string;
  memberId: string;
  employeeName: string;
  currency: string;
  displayInfo: string;
  status: string;
  createdAt: string;
}

export async function fetchPendingPaymentMethods(): Promise<PendingPaymentMethod[]> {
  const tenantId = await resolveTenantId();
  return apiClient<PendingPaymentMethod[]>(
    tenantPath(tenantId, 'payment-methods/admin/pending'),
  );
}

export async function verifyPaymentMethod(
  paymentMethodId: string,
  status: 'verified' | 'rejected',
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payment-methods/${paymentMethodId}/verify`), {
    method: 'POST',
    body: JSON.stringify({ status: status.toUpperCase() }),
  });
}
