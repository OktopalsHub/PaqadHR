import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { mapApiLeaveToLeaveRequest } from "@/lib/mappers/leave";
import type { CreateLeaveInput, LeaveBalance, LeaveRequest } from "@/lib/schemas/leave";
import { leaveRequestSchema } from "@/lib/schemas/leave";

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
  return apiClient<LeaveBalance[]>(tenantPath(tenantId, "leaves/balances"));
}

export async function createLeave(input: CreateLeaveInput): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, "leaves"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}
