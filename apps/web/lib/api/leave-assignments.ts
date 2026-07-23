import { apiClient, tenantPath } from '@/lib/api/client';

export interface AssignmentReportEntry {
  memberId: string;
  memberName?: string;
  email?: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  year: number;
}

export async function syncLeaveTypeAssignments(
  tenantId: string,
  year?: number,
): Promise<{ synced: number }> {
  const params = year ? `?year=${year}` : '';
  return apiClient<{ synced: number }>(tenantPath(tenantId, `leave-assignments/sync${params}`), {
    method: 'POST',
  });
}

export async function assignExistingLeaveTypes(
  tenantId: string,
  year?: number,
): Promise<{ assigned: number }> {
  const params = year ? `?year=${year}` : '';
  return apiClient<{ assigned: number }>(
    tenantPath(tenantId, `leave-assignments/assign-existing${params}`),
    { method: 'POST' },
  );
}

export async function assignLeaveTypeToAllUsers(
  tenantId: string,
  leaveTypeId: string,
  year?: number,
): Promise<{ assigned: number }> {
  const params = year ? `?year=${year}` : '';
  return apiClient<{ assigned: number }>(
    tenantPath(tenantId, `leave-assignments/assign-leave-type/${leaveTypeId}${params}`),
    { method: 'POST' },
  );
}

export async function removeLeaveTypeAssignments(
  tenantId: string,
  leaveTypeId: string,
  year?: number,
): Promise<{ removed: number }> {
  const params = year ? `?year=${year}` : '';
  return apiClient<{ removed: number }>(
    tenantPath(tenantId, `leave-assignments/remove-leave-type/${leaveTypeId}${params}`),
    { method: 'DELETE' },
  );
}

export async function fetchAssignmentReport(
  tenantId: string,
  year?: number,
): Promise<AssignmentReportEntry[]> {
  const params = year ? `?year=${year}` : '';
  return apiClient<AssignmentReportEntry[]>(
    tenantPath(tenantId, `leave-assignments/report${params}`),
  );
}
