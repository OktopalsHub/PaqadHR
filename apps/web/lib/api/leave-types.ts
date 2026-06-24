import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface LeaveTypeRecord {
  id: string;
  name: string;
  description: string;
  defaultDays: number;
}

export async function fetchLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const tenantId = await resolveTenantId();
  return apiClient<LeaveTypeRecord[]>(tenantPath(tenantId, 'leave-types'));
}

export async function createLeaveType(input: {
  name: string;
  description: string;
  defaultDays: number;
}): Promise<LeaveTypeRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<LeaveTypeRecord>(tenantPath(tenantId, 'leave-types'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLeaveType(
  typeId: string,
  input: Partial<{ name: string; description: string; defaultDays: number }>,
): Promise<LeaveTypeRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<LeaveTypeRecord>(tenantPath(tenantId, `leave-types/${typeId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteLeaveType(typeId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `leave-types/${typeId}`), { method: 'DELETE' });
}
