import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface TenantActivity {
  id: string;
  tenantId: string;
  actorMemberId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  status: string;
  severity: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TenantActivitiesResponse {
  items: TenantActivity[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchTenantActivities(params?: {
  page?: number;
  limit?: number;
  resourceType?: string;
  action?: string;
  resourceId?: string;
}): Promise<TenantActivitiesResponse> {
  const tenantId = await resolveTenantId();
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.resourceType) query.set('resourceType', params.resourceType);
  if (params?.action) query.set('action', params.action);
  if (params?.resourceId) query.set('resourceId', params.resourceId);
  const qs = query.toString();
  return apiClient<TenantActivitiesResponse>(
    tenantPath(tenantId, `activities${qs ? `?${qs}` : ''}`),
  );
}
