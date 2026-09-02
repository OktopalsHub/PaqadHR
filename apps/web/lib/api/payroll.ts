import { apiClient, fetchWithCsrf, getApiV1Base, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type {
  CreatePayrollRunInput,
  PayrollReadiness,
  PayrollRun,
  PayrollRunsResponse,
  PayrollSetupSummary,
} from '@/lib/schemas/payroll';

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
  return apiClient<PayrollSetupSummary>(tenantPath(tenantId, 'payroll/setup-summary'));
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

export async function payNowPayroll(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${id}/pay-now`), {
    method: 'POST',
  });
}

export async function schedulePayrollPayout(id: string, paymentDate?: string): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  const result = await apiClient<{ run: PayrollRun }>(
    tenantPath(tenantId, `payroll/runs/${id}/schedule`),
    {
      method: 'POST',
      body: JSON.stringify(paymentDate ? { paymentDate } : {}),
    },
  );
  return result.run;
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
