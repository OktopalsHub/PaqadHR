'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchTenantInvitations,
  resendTenantInvitation,
  revokeTenantInvitation,
} from '@/lib/api/tenant-invitations';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useTenantInvitations(status?: string, enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.invitations.all, tenantId, status ?? 'all'],
    queryFn: () => fetchTenantInvitations(status),
    enabled: !tenantLoading && Boolean(tenantId) && enabled,
  });
}

export function useResendTenantInvitation() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (invitationId: string) => resendTenantInvitation(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all });
      if (tenantId) {
        await queryClient.invalidateQueries({
          queryKey: [...queryKeys.invitations.all, tenantId],
        });
      }
    },
  });
}

export function useRevokeTenantInvitation() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (invitationId: string) => revokeTenantInvitation(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all });
      if (tenantId) {
        await queryClient.invalidateQueries({
          queryKey: [...queryKeys.invitations.all, tenantId],
        });
      }
    },
  });
}
