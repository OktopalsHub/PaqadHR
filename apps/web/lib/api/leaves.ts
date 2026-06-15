import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { mapApiLeaveBalances } from "@/lib/mappers/leave-balance";
import { mapApiLeaveToLeaveRequest } from "@/lib/mappers/leave";
import type { CreateLeaveInput, LeaveBalance, LeaveRequest } from "@/lib/schemas/leave";
import { leaveBalanceSchema, leaveRequestSchema } from "@/lib/schemas/leave";
import { z } from "zod";

type PaginatedLeaves = {
  records: unknown[];
};

export async function fetchLeaves(): Promise<LeaveRequest[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<PaginatedLeaves>(
    `${tenantPath(tenantId, "leaves")}?limit=100`,
  );

  return (data.records ?? []).map((leave) =>
    leaveRequestSchema.parse(mapApiLeaveToLeaveRequest(leave as never)),
  );
}

export async function fetchMyLeaveBalances(): Promise<LeaveBalance[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown[]>(tenantPath(tenantId, "leaves/balances"));
  return z.array(leaveBalanceSchema).parse(mapApiLeaveBalances(data as never));
}

export async function createLeave(input: CreateLeaveInput): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, "leaves"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveLeave(
  leaveId: string,
  comments?: string,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}/approve`), {
    method: "PATCH",
    body: JSON.stringify({ comments: comments ?? "" }),
  });
}

export async function rejectLeave(
  leaveId: string,
  comments?: string,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leaves/${leaveId}/reject`), {
    method: "PATCH",
    body: JSON.stringify({ comments: comments ?? "" }),
  });
}
