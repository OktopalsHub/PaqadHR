import { apiClient, tenantPath } from '@/lib/api/client';

export interface LeaveBalance {
  id: string;
  memberId: string;
  memberName?: string | null;
  leaveTypeId: string;
  leaveTypeName?: string | null;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  year: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLeaveBalanceInput {
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  year: number;
}

export interface UpdateLeaveBalanceInput {
  totalDays?: number;
  usedDays?: number;
  remainingDays?: number;
}

export async function fetchLeaveBalances(tenantId: string): Promise<LeaveBalance[]> {
  return apiClient<LeaveBalance[]>(tenantPath(tenantId, 'leave-balances'));
}

export async function fetchMemberLeaveBalances(
  tenantId: string,
  memberId: string,
  year?: number,
): Promise<LeaveBalance[]> {
  const params = year ? `?year=${year}` : '';
  return apiClient<LeaveBalance[]>(
    tenantPath(tenantId, `leave-balances/member/${memberId}${params}`),
  );
}

export async function fetchLeaveBalanceById(
  tenantId: string,
  balanceId: string,
): Promise<LeaveBalance> {
  return apiClient<LeaveBalance>(tenantPath(tenantId, `leave-balances/${balanceId}`));
}

export async function createLeaveBalance(
  tenantId: string,
  leaveTypeId: string,
  input: CreateLeaveBalanceInput,
): Promise<LeaveBalance> {
  return apiClient<LeaveBalance>(tenantPath(tenantId, `leave-balances`), {
    method: 'POST',
    body: JSON.stringify({ ...input, leaveTypeId }),
  });
}

export async function updateLeaveBalance(
  tenantId: string,
  balanceId: string,
  input: UpdateLeaveBalanceInput,
): Promise<LeaveBalance> {
  return apiClient<LeaveBalance>(tenantPath(tenantId, `leave-balances/${balanceId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteLeaveBalance(tenantId: string, balanceId: string): Promise<void> {
  await apiClient(tenantPath(tenantId, `leave-balances/${balanceId}`), { method: 'DELETE' });
}
