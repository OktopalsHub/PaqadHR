import { apiClient, tenantPath } from '@/lib/api/client';

export interface LeaveTypeAssignmentResult {
  memberId: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  allocatedDays: number;
  balanceId: string;
}

export interface LeaveTypeAssignmentToAllUsersResult {
  memberId: string;
  allocatedDays: number;
  balanceId: string;
}

export interface LeaveTypeAssignmentRemovalResult {
  memberId: string;
  balanceId: string;
  removedDays: number;
}

export interface MissingLeaveTypeAssignment {
  leaveTypeId: string;
  leaveTypeName: string;
  defaultDays: number;
}

export interface MissingLeaveAssignment {
  memberId: string;
  memberName: string;
  missingTypes: MissingLeaveTypeAssignment[];
}

export interface LeaveAssignmentReport {
  tenantId: string;
  year: number;
  totalLeaveTypes: number;
  totalMembers: number;
  missingAssignments: MissingLeaveAssignment[];
  completeAssignments: number;
}

export interface SyncLeaveTypeAssignmentsResponse {
  tenantId: string;
  year: number;
  totalAssignments: number;
  assignments: LeaveTypeAssignmentResult[];
  message: string;
}

export interface AssignExistingLeaveTypesResponse {
  tenantId: string;
  year: number;
  totalAssignments: number;
  assignments: LeaveTypeAssignmentResult[];
}

export interface AssignLeaveTypeToAllUsersResponse {
  leaveTypeId: string;
  leaveTypeName: string;
  totalAssignments: number;
  assignments: LeaveTypeAssignmentToAllUsersResult[];
}

export interface RemoveLeaveTypeAssignmentsResponse {
  leaveTypeId: string;
  totalRemovals: number;
  removals: LeaveTypeAssignmentRemovalResult[];
  balancesWithUsedDays: number;
}

export async function syncLeaveTypeAssignments(
  tenantId: string,
  year?: number,
): Promise<SyncLeaveTypeAssignmentsResponse> {
  const params = year ? `?year=${year}` : '';
  return apiClient<SyncLeaveTypeAssignmentsResponse>(
    tenantPath(tenantId, `leave-assignments/sync${params}`),
    {
      method: 'POST',
    },
  );
}

export async function assignExistingLeaveTypes(
  tenantId: string,
  year?: number,
): Promise<AssignExistingLeaveTypesResponse> {
  const params = year ? `?year=${year}` : '';
  return apiClient<AssignExistingLeaveTypesResponse>(
    tenantPath(tenantId, `leave-assignments/assign-existing${params}`),
    { method: 'POST' },
  );
}

export async function assignLeaveTypeToAllUsers(
  tenantId: string,
  leaveTypeId: string,
  year?: number,
): Promise<AssignLeaveTypeToAllUsersResponse> {
  const params = year ? `?year=${year}` : '';
  return apiClient<AssignLeaveTypeToAllUsersResponse>(
    tenantPath(tenantId, `leave-assignments/assign-leave-type/${leaveTypeId}${params}`),
    { method: 'POST' },
  );
}

export async function removeLeaveTypeAssignments(
  tenantId: string,
  leaveTypeId: string,
  year?: number,
): Promise<RemoveLeaveTypeAssignmentsResponse> {
  const params = year ? `?year=${year}` : '';
  return apiClient<RemoveLeaveTypeAssignmentsResponse>(
    tenantPath(tenantId, `leave-assignments/remove-leave-type/${leaveTypeId}${params}`),
    { method: 'DELETE' },
  );
}

export async function fetchAssignmentReport(
  tenantId: string,
  year?: number,
): Promise<LeaveAssignmentReport> {
  const params = year ? `?year=${year}` : '';
  return apiClient<LeaveAssignmentReport>(
    tenantPath(tenantId, `leave-assignments/report${params}`),
  );
}
