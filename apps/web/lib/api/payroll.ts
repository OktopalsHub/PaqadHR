import { apiClient, fetchWithCsrf, getApiV1Base, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type {
  CreatePayrollRunInput,
  PayrollReadiness,
  PayrollRun,
  PayrollRunsResponse,
} from '@/lib/schemas/payroll';

export async function fetchPayrollRuns(): Promise<PayrollRunsResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRunsResponse>(tenantPath(tenantId, 'payroll/runs'));
}

export async function fetchPayrollRun(id: string): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRun>(tenantPath(tenantId, `payroll/runs/${id}`));
}

export async function createPayrollRun(input: CreatePayrollRunInput): Promise<PayrollRun> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollRun>(tenantPath(tenantId, 'payroll/runs'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function calculatePayrollRun(
  id: string,
): Promise<{ warnings: string[]; readiness: PayrollReadiness['items'] }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `payroll/runs/${id}/calculate`), {
    method: 'POST',
  });
}

export async function fetchPayrollReadiness(id: string): Promise<PayrollReadiness> {
  const tenantId = await resolveTenantId();
  return apiClient<PayrollReadiness>(tenantPath(tenantId, `payroll/runs/${id}/readiness`));
}

export async function removePayrollItem(runId: string, itemId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `payroll/runs/${runId}/items/${itemId}`), {
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
