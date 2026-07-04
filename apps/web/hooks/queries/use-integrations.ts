'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkInviteUsers,
  connectSlackOAuth,
  createSlackChannel,
  fetchShoutoutSlackStatus,
  fetchSlackChannels,
  fetchSyncStatus,
  fetchUnmatchedUsers,
  matchUser,
  setupShoutoutChannel,
  triggerUserSync,
} from '@/lib/api/integrations';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useShoutoutSlackStatus() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.integrations.shoutoutSlackStatus(tenantId ?? ''),
    queryFn: () => fetchShoutoutSlackStatus(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useSlackChannels(integrationId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.integrations.slackChannels(integrationId ?? ''),
    queryFn: () => fetchSlackChannels(integrationId!),
    enabled: Boolean(integrationId) && enabled,
  });
}

export function useConnectSlack() {
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant selected');
      const { url } = await connectSlackOAuth(tenantId);
      window.location.href = url;
    },
  });
}

export function useCreateSlackChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ integrationId, name }: { integrationId: string; name: string }) =>
      createSlackChannel(integrationId, name),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.slackChannels(variables.integrationId),
      });
    },
  });
}

export function useSetupShoutoutChannel() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      integrationId,
      platformChannelId,
      platformChannelName,
    }: {
      integrationId: string;
      platformChannelId: string;
      platformChannelName: string;
    }) => setupShoutoutChannel(integrationId, platformChannelId, platformChannelName),
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.shoutoutSlackStatus(tenantId),
        });
      }
    },
  });
}

export function useSyncStatus(integrationId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: queryKeys.integrations.syncStatus(integrationId ?? ''),
    queryFn: () => fetchSyncStatus(tenantId!, integrationId!),
    enabled: Boolean(tenantId) && Boolean(integrationId),
  });
}

export function useUnmatchedUsers(integrationId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: queryKeys.integrations.unmatchedUsers(integrationId ?? ''),
    queryFn: () => fetchUnmatchedUsers(tenantId!, integrationId!),
    enabled: Boolean(tenantId) && Boolean(integrationId),
  });
}

export function useMatchUser() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      integrationId,
      platformUserId,
      tenantMemberId,
    }: {
      integrationId: string;
      platformUserId: string;
      tenantMemberId: string;
    }) => matchUser(tenantId!, integrationId, platformUserId, tenantMemberId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.syncStatus(variables.integrationId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.unmatchedUsers(variables.integrationId),
      });
    },
  });
}

export function useBulkInviteUsers() {
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (integrationId: string) => bulkInviteUsers(tenantId!, integrationId),
  });
}

export function useTriggerUserSync() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (integrationId: string) => triggerUserSync(tenantId!, integrationId),
    onSuccess: (_, integrationId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.syncStatus(integrationId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.unmatchedUsers(integrationId),
      });
    },
  });
}
