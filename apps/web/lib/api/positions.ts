import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type ApiPosition = {
  id: string;
  title: string;
  department?: string | null;
  description?: string | null;
  isActive: boolean;
  color?: string | null;
};

export type ApiPositionHistoryEntry = {
  id: string;
  tenantMemberId: string;
  positionId: string;
  assignedAt: string;
  isCurrent: boolean;
  position?: ApiPosition | null;
};

export type AssignPositionInput = {
  positionId: string;
  assignedAt?: string;
};

export type CreatePositionInput = {
  title: string;
  department?: string;
  description?: string;
  isActive?: boolean;
  color?: string;
};

export type UpdatePositionInput = Partial<CreatePositionInput>;

export async function fetchPositions(): Promise<ApiPosition[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ApiPosition[]>(tenantPath(tenantId, 'positions'));
  return Array.isArray(data) ? data : [];
}

export async function createPosition(input: CreatePositionInput): Promise<ApiPosition> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiPosition>(tenantPath(tenantId, 'positions'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePosition(id: string, input: UpdatePositionInput): Promise<ApiPosition> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiPosition>(tenantPath(tenantId, `positions/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePosition(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient<unknown>(tenantPath(tenantId, `positions/${id}`), {
    method: 'DELETE',
  });
}

export async function restorePosition(id: string): Promise<ApiPosition> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiPosition>(tenantPath(tenantId, `positions/${id}/restore`), {
    method: 'POST',
  });
}

export async function fetchPositionHistory(memberId: string): Promise<ApiPositionHistoryEntry[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ApiPositionHistoryEntry[]>(
    tenantPath(tenantId, `positions/member/${memberId}/history`),
  );
  return Array.isArray(data) ? data : [];
}

export async function assignPosition(
  memberId: string,
  input: AssignPositionInput,
): Promise<ApiPositionHistoryEntry> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiPositionHistoryEntry>(
    tenantPath(tenantId, `positions/member/${memberId}/assign`),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
