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
  /** Effective page size the API applied, after its own clamping. */
  limit?: number;
  page?: number;
  pageCount?: number;
  totalItems?: number;
  nextPage?: number | null;
};

/** Matches the API's `PAGINATION_MAX_LIMIT`; the server clamps and echoes its own back. */
const LEAVES_PAGE_SIZE = 200;

/** Bound the page walk so a bad `pageCount` can never spin forever. */
const MAX_LEAVE_PAGES = 20;

type PageResult = { records: unknown[]; nextPage: number | null };

/**
 * Walk paginated pages and concatenate them. Follows the server's own `nextPage`
 * rather than assuming a page size, so lowering the API cap can never silently
 * truncate the calendar. An empty first page yields `[]` with no second request.
 */
export async function collectAllPages(
  fetchPage: (page: number) => Promise<PageResult>,
  maxPages = MAX_LEAVE_PAGES,
): Promise<unknown[]> {
  const records: unknown[] = [];
  let page = 1;
  for (let fetched = 0; fetched < maxPages; fetched += 1) {
    const result = await fetchPage(page);
    records.push(...result.records);
    if (result.nextPage == null) break;
    page = result.nextPage;
  }
  return records;
}

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

/**
 * Approved leave for the calendar window. Requests the API's maximum page size (200)
 * and still walks pages, so a tenant with more approved leave than one page holds is
 * complete rather than truncated.
 */
export async function fetchLeavesForCalendar(options: {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<LeaveRequest[]> {
  const tenantId = await resolveTenantId();
  const canViewTeamLeaves = await resolveViewerCanViewTeamLeaves();
  const basePath = tenantPath(tenantId, canViewTeamLeaves ? 'leaves' : 'leaves/me');
  // Clamp rather than trust the caller: the API rejects limit above its max with a 400.
  const pageSize = Math.min(Math.max(options.limit ?? LEAVES_PAGE_SIZE, 1), LEAVES_PAGE_SIZE);

  const records = await collectAllPages(async (page) => {
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
    if (options.status) params.set('status', options.status);
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    const data = await apiClient<PaginatedLeaves>(`${basePath}?${params.toString()}`);
    return { records: data.records ?? [], nextPage: data.nextPage ?? null };
  });

  return mapLeaveRecords({ records });
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

export async function cancelLeave(leaveId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}/cancel`), {
    method: 'PATCH',
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
