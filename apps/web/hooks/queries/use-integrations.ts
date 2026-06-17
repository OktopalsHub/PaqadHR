'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  connectSlackOAuth,
  fetchShoutoutSlackStatus,
  fetchSlackChannels,
  setupShoutoutChannel,
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

export function useSlackChannels(integrationId?: string) {
  return useQuery({
    queryKey: queryKeys.integrations.slackChannels(integrationId ?? ''),
    queryFn: () => fetchSlackChannels(integrationId!),
    enabled: Boolean(integrationId),
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
