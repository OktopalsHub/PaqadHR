import { apiClient, tenantPath } from '@/lib/api/client';

export type PendingAgentAction = {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  correlationId: string | null;
  actorType: string;
  params: Record<string, unknown>;
  apiKeyName: string | null;
  requestedByMemberName: string | null;
};

export function fetchPendingAgentApprovals(tenantId: string): Promise<PendingAgentAction[]> {
  return apiClient<PendingAgentAction[]>(tenantPath(tenantId, 'agent/approvals/pending'));
}

export function approveAgentAction(tenantId: string, actionId: string): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>(
    tenantPath(tenantId, `agent/approvals/${actionId}/approve`),
    { method: 'POST' },
  );
}

export function rejectAgentAction(
  tenantId: string,
  actionId: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>(
    tenantPath(tenantId, `agent/approvals/${actionId}/reject`),
    {
      method: 'POST',
      body: reason ? { reason } : {},
    },
  );
}
