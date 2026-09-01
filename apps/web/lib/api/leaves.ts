import { z } from 'zod';
import { apiClient, tenantPath } from '@/lib/api/client';
import { fetchTenantMembers } from '@/lib/api/employees';
import { fetchUserTenants, resolveTenantId } from '@/lib/api/tenants';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { mapApiLeaveToLeaveRequest } from '@/lib/mappers/leave';
import { mapApiLeaveBalances } from '@/lib/mappers/leave-balance';
import type {
  CreateLeaveInput,
  LeaveBalance,
  LeaveRequest,
  UpdateLeaveInput,
} from '@/lib/schemas/leave';
import { leaveBalanceSchema, leaveRequestSchema } from '@/lib/schemas/leave';

type PaginatedLeaves = {
  records: unknown[];
};

async function resolveViewerCanViewTeamLeaves(): Promise<boolean> {
  const tenantId = await resolveTenantId();
  const tenants = await fetchUserTenants();
  const tenant = tenants.find((entry) => entry.id === tenantId);
  const role = tenant?.member?.role;
  if (isTenantAdmin(role)) {
    return true;
  }
  const viewerId = tenant?.member?.id;
  if (!viewerId) {
    return false;
  }
  const members = await fetchTenantMembers();
  return members.some((member) => member.reportsToId === viewerId);
}

function mapLeaveRecords(data: PaginatedLeaves): LeaveRequest[] {
  return (data.records ?? []).map((leave) =>
    leaveRequestSchema.parse(mapApiLeaveToLeaveRequest(leave as never)),
  );
}

export async function fetchLeaves(): Promise<LeaveRequest[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<PaginatedLeaves>(`${tenantPath(tenantId, 'leaves')}?limit=100`);
  return mapLeaveRecords(data);
}

export async function fetchMyLeaves(): Promise<LeaveRequest[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<PaginatedLeaves>(`${tenantPath(tenantId, 'leaves/me')}?limit=100`);
  return mapLeaveRecords(data);
}

export async function fetchLeavesForCalendar(options: {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<LeaveRequest[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 200));
  if (options.status) params.set('status', options.status);
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);

  const canViewTeamLeaves = await resolveViewerCanViewTeamLeaves();
  const path = canViewTeamLeaves
    ? `${tenantPath(tenantId, 'leaves')}?${params.toString()}`
    : `${tenantPath(tenantId, 'leaves/me')}?${params.toString()}`;

  const data = await apiClient<PaginatedLeaves>(path);
  return mapLeaveRecords(data);
}

export async function fetchMyLeaveBalances(): Promise<LeaveBalance[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown[]>(tenantPath(tenantId, 'leaves/balances'));
  return z.array(leaveBalanceSchema).parse(mapApiLeaveBalances(data as never));
}

export async function createLeave(input: CreateLeaveInput): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, 'leaves'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLeave(leaveId: string, input: UpdateLeaveInput): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteLeave(leaveId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}`), {
    method: 'DELETE',
  });
}

export async function approveLeave(leaveId: string, comments?: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}/approve`), {
    method: 'PATCH',
    body: JSON.stringify({ comments: comments ?? '' }),
  });
}

export async function rejectLeave(leaveId: string, comments?: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}/reject`), {
    method: 'PATCH',
    body: JSON.stringify({ comments: comments ?? '' }),
  });
}
