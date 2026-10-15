import type { TenantSettingsData } from '@/lib/api/tenant-settings';
import { queryKeys } from '@/lib/query/keys';

export function shouldInvalidatePaymentMethodCurrencies(
  variables: Partial<TenantSettingsData>,
): boolean {
  return (
    variables.general?.cryptoEnabled !== undefined ||
    variables.general?.payrollCurrencies !== undefined
  );
}

export function paymentMethodCurrenciesQueryKey(tenantId: string | null | undefined) {
  return [...queryKeys.paymentMethods.currencies, tenantId] as const;
}
