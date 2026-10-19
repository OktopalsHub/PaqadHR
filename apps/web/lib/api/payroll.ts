import { apiClient, fetchWithCsrf, getApiV1Base, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type {
  CreatePayrollRunInput,
  PayrollReadiness,
  PayrollRun,
  PayrollRunsResponse,
  PayrollSetupSummary,
} from '@/lib/schemas/payroll';
import { payrollSetupSummarySchema } from '@/lib/schemas/payroll';

export async function fetchPayrollRuns(): Promise<PayrollRunsResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRunsResponse>(tenantPath(tenantId, 'payroll/runs?limit=100'));
}

export async function fetchPayrollRun(id: string): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRun>(tenantPath(tenantId, `payroll/runs/${id}`));
}

export async function createPayrollRun(
  input: CreatePayrollRunInput,
): Promise<PayrollRun & { alreadyExists?: boolean }> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRun & { alreadyExists?: boolean }>(tenantPath(tenantId, 'payroll/runs'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function calculatePayrollRun(
  id: string,
  adjustments?: import('@/lib/schemas/payroll').PayrollAdjustmentLine[],
): Promise<{ warnings: string[]; readiness: PayrollReadiness['items'] }> {
  const tenantId = await resolveTenantId();
  const path = adjustments?.length
    ? `payroll/runs/${id}/calculate-with-adjustments`
    : `payroll/runs/${id}/calculate`;
  return apiClient(tenantPath(tenantId, path), {
    method: 'POST',
    body: adjustments?.length ? JSON.stringify({ adjustments }) : undefined,
  });
}

export async function updatePayrollItem(
  runId: string,
  itemId: string,
  body: { adjustmentLines: import('@/lib/schemas/payroll').PayrollAdjustmentLine[] },
): Promise<import('@/lib/schemas/payroll').PayrollRunDetail> {
  const tenantId = await resolveTenantId();
  const result = await apiClient<{ payrollRun: import('@/lib/schemas/payroll').PayrollRunDetail }>(
    tenantPath(tenantId, `payroll/runs/${runId}/items/${itemId}`),
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
  return result.payrollRun;
}

export async function fetchRunPayslips(runId: string) {
  const tenantId = await resolveTenantId();
  return apiClient<import('@/lib/schemas/payroll').RunPayslip[]>(
    tenantPath(tenantId, `payroll/runs/${runId}/payslips`),
  );
}

export async function publishPayslips(
  runId: string,
  body?: { itemIds?: string[]; sendEmail?: boolean },
) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${runId}/payslips/publish`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchMemberPublishedPayslips(memberId: string) {
  const tenantId = await resolveTenantId();
  return apiClient<import('@/lib/schemas/payroll').PublishedPayslip[]>(
    tenantPath(tenantId, `payroll/members/${memberId}/published-payslips`),
  );
}

export async function downloadPayslipPdf(runId: string, itemId: string, filename: string) {
  const tenantId = await resolveTenantId();
  const response = await fetchWithCsrf(
    `${getApiV1Base()}${tenantPath(tenantId, `payroll/runs/${runId}/items/${itemId}/payslip/download`)}`,
  );
  if (!response.ok) {
    throw new Error('Failed to download payslip');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchPayrollReadiness(id: string): Promise<PayrollReadiness> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollReadiness>(tenantPath(tenantId, `payroll/runs/${id}/readiness`));
}

export async function fetchPayrollSetupSummary(): Promise<PayrollSetupSummary> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, 'payroll/setup-summary'));
  return payrollSetupSummarySchema.parse(data);
}

export async function updatePayrollRun(
  id: string,
  input: import('@/lib/schemas/payroll').PatchPayrollRunInput,
): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  const result = await apiClient<{ payrollRun: PayrollRun }>(
    tenantPath(tenantId, `payroll/runs/${id}`),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return result.payrollRun;
}

export async function updatePayrollRunTitle(id: string, title: string): Promise<PayrollRun> {
  return updatePayrollRun(id, { title });
}

export async function notifyMemberPaymentSetup(memberId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, 'payroll/notify-payment-setup'), {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
}

export async function removePayrollItem(runId: string, itemId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${runId}/items/${itemId}`), {
    method: 'DELETE',
  });
}

export async function deletePayrollRun(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${id}`), {
    method: 'DELETE',
  });
}

export async function reopenPayrollRun(id: string): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  const result = await apiClient<{ payrollRun: PayrollRun }>(
    tenantPath(tenantId, `payroll/runs/${id}/reopen`),
    { method: 'POST' },
  );
  return result.payrollRun;
}

export async function notifyEmployeePaymentSetup(runId: string, itemId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(
    tenantPath(tenantId, `payroll/runs/${runId}/items/${itemId}/notify-payment-setup`),
    { method: 'POST' },
  );
}

export async function processPayrollRun(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${id}/process-multi-payment`), {
    method: 'POST',
  });
}

export async function fundAndPayPayroll(id: string): Promise<{
  action: 'paid' | 'checkout';
  message?: string;
  checkoutUrl?: string;
  orderReference?: string;
  result?: {
    totalItems: number;
    successfulPayments: number;
    failedPayments: number;
    processingPayments?: number;
    payoutResults?: Array<{ error?: string; outcome?: string }>;
  };
  preflight?: {
    ok: boolean;
    shortfall: number;
    currency: string;
    message: string;
    dashboardUrl?: string;
    canCheckout?: boolean;
  };
}> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/fund-and-pay`), {
    method: 'POST',
  });
}

export type PayrollFundingPreflight = {
  ok: boolean;
  provider: string;
  currency: string;
  requiredAmount: number;
  availableBalance: number | null;
  shortfall: number;
  balanceSupported: boolean;
  canCheckout: boolean;
  dashboardUrl: string;
  message: string;
  employeeTotal?: number;
  platformFee?: number;
  feePercentage?: number;
  payoutFeeReserve?: number;
  payoutFeePerTransfer?: number;
  payoutTransferCount?: number;
};

export async function fetchPayrollFundingPreflight(id: string): Promise<PayrollFundingPreflight> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollFundingPreflight>(
    tenantPath(tenantId, `payroll/runs/${id}/fund-and-pay/preflight`),
  );
}

export async function payNowPayroll(id: string): Promise<{
  message: string;
  result: {
    totalItems: number;
    successfulPayments: number;
    failedPayments: number;
    processingPayments?: number;
    payoutResults?: Array<{ error?: string; outcome?: string }>;
  };
}> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/pay-now`), {
    method: 'POST',
  });
}

export async function retryFailedPayrollPayments(
  id: string,
  itemIds?: string[],
): Promise<{
  message: string;
  result: {
    totalItems: number;
    successfulPayments: number;
    failedPayments: number;
    processingPayments?: number;
    payoutResults?: Array<{ error?: string; outcome?: string }>;
  };
}> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/retry-failed-payments`), {
    method: 'POST',
    body: JSON.stringify(itemIds?.length ? { itemIds } : {}),
  });
}

export type RetryFundingPreview = {
  amount: number;
  currency: string;
  selectedItemIds: string[];
  platformFee: 0;
  payoutFeeReserve: number;
};

export async function previewRetryFunding(
  id: string,
  itemIds: string[],
): Promise<RetryFundingPreview> {
  const tenantId = await resolveTenantId();
  return apiClient<RetryFundingPreview>(
    tenantPath(tenantId, `payroll/runs/${id}/retry-funding/preflight`),
    {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    },
  );
}

export async function approveRetryFunding(
  id: string,
  itemIds: string[],
  expectedAmount: number,
  currency: string,
): Promise<RetryFundingPreview & { approved: true; orderReference: string }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/retry-funding/approve`), {
    method: 'POST',
    body: JSON.stringify({ itemIds, expectedAmount, currency }),
  });
}

export async function createRetryFundingCheckout(
  id: string,
): Promise<{ checkoutUrl: string; orderReference: string; amount: number; currency: string }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/retry-funding/checkout`), {
    method: 'POST',
  });
}

export type RetryFundingReconcileResult = {
  status: 'funded' | 'pending' | 'unavailable';
  orderReference?: string;
  amount?: number;
  currency?: string;
  reason?: string;
};

/**
 * Re-verify a pending retry-funding checkout with the payout provider. Safe to call repeatedly:
 * it only proves the company's payment and credits the run's funding ledger, and it never
 * starts payout. Use it when a checkout was completed but the funding webhook was dropped.
 */
export async function reconcileRetryFunding(id: string): Promise<RetryFundingReconcileResult> {
  const tenantId = await resolveTenantId();
  return apiClient<RetryFundingReconcileResult>(
    tenantPath(tenantId, `payroll/runs/${id}/retry-funding/reconcile`),
    { method: 'POST' },
  );
}

export type PayrollFundingLedger = {
  payrollRunId: string;
  entries: Array<{
    id: string;
    eventType: string;
    amount: string | number;
    currency: string;
    provider: string;
    providerReference: string | null;
    payrollItemId: string | null;
    createdAt: string;
    approvedById: string | null;
    evidence?: Record<string, unknown> | null;
  }>;
  verifiedFundingByCurrency: Record<string, number>;
  confirmedPayoutDebitsByCurrency?: Record<string, number>;
  fundingEvidenceComplete: boolean;
  retryAuthorization: 'blocked' | 'authorized';
  reason?: string;
};

export async function fetchPayrollFundingLedger(id: string): Promise<PayrollFundingLedger> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollFundingLedger>(tenantPath(tenantId, `payroll/runs/${id}/funding-ledger`));
}

export async function schedulePayrollPayout(
  id: string,
  paymentDate?: string,
): Promise<
  | { action: 'scheduled'; message: string; run: PayrollRun }
  | {
      action: 'checkout';
      message: string;
      checkoutUrl: string;
      orderReference: string;
      preflight?: { currency: string; message: string; shortfall: number };
    }
> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/schedule`), {
    method: 'POST',
    body: JSON.stringify(paymentDate ? { paymentDate } : {}),
  });
}

export async function approvePayrollRun(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${id}/approve`), {
    method: 'POST',
  });
}

export async function disbursePayrollRun(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${id}/disburse`), {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  });
}

export async function downloadPayrollBankFile(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  const response = await fetchWithCsrf(
    `${getApiV1Base()}${tenantPath(tenantId, `payroll/runs/${id}/export/bank-file`)}`,
  );
  if (!response.ok) {
    throw new Error('Failed to export bank file');
  }
  const csv = await response.text();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-${id.slice(0, 8)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
