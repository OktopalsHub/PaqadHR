import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveAgentAction,
  fetchPendingAgentApprovals,
  rejectAgentAction,
} from '@/lib/api/agent-approvals';
import { queryKeys } from '@/lib/query/keys';

export function usePendingAgentApprovals(tenantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agentApprovals.pending(tenantId ?? ''),
    queryFn: () => fetchPendingAgentApprovals(tenantId!),
    enabled: Boolean(tenantId && enabled),
  });
}

export function useApproveAgentAction(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) => approveAgentAction(tenantId!, actionId),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agentApprovals.pending(tenantId) });
      }
    },
  });
}

export function useRejectAgentAction(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, reason }: { actionId: string; reason?: string }) =>
      rejectAgentAction(tenantId!, actionId, reason),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agentApprovals.pending(tenantId) });
      }
    },
  });
}
