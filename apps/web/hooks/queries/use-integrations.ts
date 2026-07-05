'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkInviteUsers,
  connectSlackOAuth,
  createSlackChannel,
  disconnectSlackIntegration,
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
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.integrations.slackChannels(integrationId ?? ''),
    queryFn: () => fetchSlackChannels(tenantId!, integrationId!),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(integrationId) && enabled,
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

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (integrationId: string) => {
      if (!tenantId) throw new Error('No tenant selected');
      return disconnectSlackIntegration(tenantId, integrationId);
    },
    onSuccess: (_, integrationId) => {
      if (tenantId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.shoutoutSlackStatus(tenantId),
        });
      }
      void queryClient.removeQueries({
        queryKey: queryKeys.integrations.slackChannels(integrationId),
      });
      void queryClient.removeQueries({
        queryKey: queryKeys.integrations.syncStatus(integrationId),
      });
      void queryClient.removeQueries({
        queryKey: queryKeys.integrations.unmatchedUsers(integrationId),
      });
    },
  });
}

export function useCreateSlackChannel() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ integrationId, name }: { integrationId: string; name: string }) => {
      if (!tenantId) throw new Error('No tenant selected');
      return createSlackChannel(tenantId, integrationId, name);
    },
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
    }) => {
      if (!tenantId) throw new Error('No tenant selected');
      return setupShoutoutChannel(tenantId, integrationId, platformChannelId, platformChannelName);
    },
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
