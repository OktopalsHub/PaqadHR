import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export async function fetchPaymentPasscodeStatus(
  memberId: string,
): Promise<{ hasPasscode: boolean }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payment-security/${memberId}/status`));
}

export async function changePaymentPasscode(
  memberId: string,
  currentPasscode: string,
  newPasscode: string,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payment-security/${memberId}/change-passcode`), {
    method: 'POST',
    body: JSON.stringify({ currentPasscode, newPasscode }),
  });
}
