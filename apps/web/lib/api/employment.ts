import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type { ApiPosition } from '@/lib/api/positions';
export { fetchPositions } from '@/lib/api/positions';

export type ApiEmployment = {
  id: string;
  tenantMemberId: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  payType: string;
  paySchedule: string;
  payRate: number | string;
  comments?: string | null;
  positionId?: string;
};

export type CurrentSalary = {
  memberId: string;
  payRate: number;
  payType: string;
  paySchedule: string;
  currency?: string;
};

export type CreateEmploymentInput = {
  startDate: string;
  positionId?: string;
  payRate: number;
  payType?: string;
  paySchedule?: string;
  reportsToId?: string;
  comments?: string;
};

export type CreateCompensationInput = {
  effectiveDate: string;
  payRate: number;
  payType?: string;
  paySchedule?: string;
  currency?: string;
  comments?: string;
};

export type UpdateEmploymentInput = {
  payRate?: number;
  payType?: string;
  paySchedule?: string;
  status?: string;
  comments?: string;
  reportsToId?: string | null;
};

export async function fetchEmployments(memberId: string): Promise<ApiEmployment[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ApiEmployment[]>(
    tenantPath(tenantId, `members/${memberId}/employments`),
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchCurrentSalaries(): Promise<CurrentSalary[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<CurrentSalary[]>(tenantPath(tenantId, 'compensation/current'));
  return Array.isArray(data) ? data : [];
}

export async function createEmployment(
  memberId: string,
  input: CreateEmploymentInput,
): Promise<ApiEmployment> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiEmployment>(tenantPath(tenantId, `members/${memberId}/employments`), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addCompensation(
  memberId: string,
  input: CreateCompensationInput,
): Promise<ApiEmployment> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiEmployment>(tenantPath(tenantId, `members/${memberId}/compensation`), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateEmployment(
  employmentId: string,
  input: UpdateEmploymentInput,
): Promise<ApiEmployment> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiEmployment>(tenantPath(tenantId, `employments/${employmentId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
