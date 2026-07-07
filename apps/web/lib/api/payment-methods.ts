import type { z } from 'zod';
import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type {
  CreatePaymentMethodInput,
  PaymentMethodSummary,
  supportedCurrenciesSchema,
} from '@/lib/schemas/payment-method';
import { isCryptoCurrency } from '@/lib/schemas/payment-method';

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
  const isCrypto = input.type === 'crypto' || isCryptoCurrency(input.currency);
  const body = {
    ...input,
    type: input.type ?? (isCrypto ? 'crypto' : 'bank'),
    isPrimary: input.isPrimary ?? true,
    accountNumber: input.accountNumber ?? input.walletAddress,
  };
  return apiClient<PaymentMethodSummary>(tenantPath(tenantId, 'payment-methods'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface PendingPaymentMethod {
  id: string;
  memberId: string;
  employeeName: string;
  currency: string;
  displayInfo: string;
  bankName?: string;
  accountName?: string;
  institutionCode?: string;
  accountLast4?: string;
  status: string;
  createdAt: string;
}

export async function fetchPendingPaymentMethods(): Promise<PendingPaymentMethod[]> {
  const tenantId = await resolveTenantId();
  return apiClient<PendingPaymentMethod[]>(tenantPath(tenantId, 'payment-methods/admin/pending'));
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

export type NigerianBank = { code: string; name: string };

export async function fetchNigerianBanks(): Promise<NigerianBank[]> {
  const tenantId = await resolveTenantId();
  const result = await apiClient<{ banks: NigerianBank[] }>(
    tenantPath(tenantId, 'payment-methods/banks'),
  );
  return result.banks;
}

export async function lookupNigerianBankAccount(input: {
  accountNumber: string;
  bankCode: string;
  bankName?: string;
}): Promise<{ accountNumber: string; accountName: string; bankCode: string; bankName: string }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'payment-methods/bank-lookup'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type UpdatePaymentMethodInput = {
  currency?: string;
  bankName?: string;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;
  country?: string;
  currentPasscode: string;
  otpProof: string;
  newPasscode?: string;
  isPrimary?: boolean;
};

export async function updatePaymentMethod(
  paymentMethodId: string,
  input: UpdatePaymentMethodInput,
): Promise<PaymentMethodSummary> {
  const tenantId = await resolveTenantId();
  return apiClient<PaymentMethodSummary>(
    tenantPath(tenantId, `payment-methods/${paymentMethodId}`),
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export async function deletePaymentMethod(
  paymentMethodId: string,
  passcode?: string,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payment-methods/${paymentMethodId}`), {
    method: 'DELETE',
    body: JSON.stringify(passcode ? { passcode } : {}),
  });
}

export async function changePaymentMethodPasscode(
  paymentMethodId: string,
  currentPasscode: string,
  newPasscode: string,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payment-methods/${paymentMethodId}/passcode`), {
    method: 'PUT',
    body: JSON.stringify({ currentPasscode, newPasscode }),
  });
}
