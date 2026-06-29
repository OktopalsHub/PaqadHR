import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface AttendancePolicy {
  id: string;
  name: string;
  description: string;
  workStartTime: string;
  workEndTime: string;
  lateThreshold: number;
  halfDayThreshold: number;
  gracePeriod: number;
  maxSessionsPerDay: number;
  isActive?: boolean;
}

export type CreateAttendancePolicyInput = Omit<AttendancePolicy, 'id' | 'isActive'>;

export type UpdateAttendancePolicyInput = Partial<CreateAttendancePolicyInput>;

export async function fetchAttendancePolicies(): Promise<AttendancePolicy[]> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendancePolicy[]>(tenantPath(tenantId, 'attendance/policies'));
}

export async function createAttendancePolicy(
  input: CreateAttendancePolicyInput,
): Promise<AttendancePolicy> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendancePolicy>(tenantPath(tenantId, 'attendance/policies'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAttendancePolicy(
  policyId: string,
  input: UpdateAttendancePolicyInput,
): Promise<AttendancePolicy> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendancePolicy>(tenantPath(tenantId, `attendance/policies/${policyId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAttendancePolicy(policyId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `attendance/policies/${policyId}`), {
    method: 'DELETE',
  });
}
