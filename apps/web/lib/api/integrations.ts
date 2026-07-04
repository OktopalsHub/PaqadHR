import { apiClient, tenantPath } from '@/lib/api/client';

export type ShoutoutSlackStatus = {
  configured: boolean;
  channelName?: string;
  integrationId?: string;
};

export type SlackChannel = {
  id: string;
  name: string;
  type?: 'public' | 'private';
  memberCount?: number;
  description?: string;
};

export async function fetchShoutoutSlackStatus(tenantId: string): Promise<ShoutoutSlackStatus> {
  return apiClient<ShoutoutSlackStatus>(tenantPath(tenantId, 'integrations/shoutouts/status'));
}

export async function connectSlackOAuth(tenantId: string): Promise<{ url: string }> {
  return apiClient<{ url: string }>(tenantPath(tenantId, 'integrations/oauth/connect/slack'));
}

export async function disconnectSlackIntegration(
  tenantId: string,
  integrationId: string,
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(
    tenantPath(tenantId, `integrations/${integrationId}/disconnect`),
    { method: 'POST' },
  );
}

export async function fetchSlackChannels(
  tenantId: string,
  integrationId: string,
): Promise<SlackChannel[]> {
  const data = await apiClient<SlackChannel[] | { channels: SlackChannel[] }>(
    tenantPath(tenantId, `integrations/${integrationId}/channels`),
  );
  return Array.isArray(data) ? data : (data.channels ?? []);
}

export async function createSlackChannel(
  tenantId: string,
  integrationId: string,
  name: string,
): Promise<SlackChannel> {
  return apiClient<SlackChannel>(
    tenantPath(tenantId, `integrations/${integrationId}/channels/create`),
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
  );
}

export async function setupShoutoutChannel(
  tenantId: string,
  integrationId: string,
  platformChannelId: string,
  platformChannelName: string,
): Promise<{
  success: boolean;
  message: string;
  testMessageSent?: boolean;
  testMessageError?: string;
}> {
  return apiClient(tenantPath(tenantId, `integrations/${integrationId}/setup-channel`), {
    method: 'POST',
    body: JSON.stringify({ platformChannelId, platformChannelName }),
  });
}

export type SlackUnmatchedUser = {
  id: string;
  integrationId: string;
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformEmail?: string;
  platformAvatarUrl?: string;
};

export type SlackSyncStatus = {
  total: number;
  matched: number;
  unmatched: number;
  matchRate: number;
};

export async function fetchUnmatchedUsers(
  tenantId: string,
  integrationId: string,
): Promise<SlackUnmatchedUser[]> {
  return apiClient<SlackUnmatchedUser[]>(
    tenantPath(tenantId, `integrations/${integrationId}/unmatched-users`),
  );
}

export async function fetchSyncStatus(
  tenantId: string,
  integrationId: string,
): Promise<SlackSyncStatus> {
  return apiClient<SlackSyncStatus>(
    tenantPath(tenantId, `integrations/${integrationId}/sync-status`),
  );
}

export async function matchUser(
  tenantId: string,
  integrationId: string,
  platformUserId: string,
  tenantMemberId: string,
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(
    tenantPath(tenantId, `integrations/${integrationId}/match-user`),
    {
      method: 'POST',
      body: JSON.stringify({ platformUserId, tenantMemberId }),
    },
  );
}

export async function bulkInviteUsers(
  tenantId: string,
  integrationId: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  return apiClient<{ sent: number; failed: number; errors: string[] }>(
    tenantPath(tenantId, `integrations/${integrationId}/bulk-invite`),
    {
      method: 'POST',
    },
  );
}

export async function triggerUserSync(
  tenantId: string,
  integrationId: string,
): Promise<{ matched: number; unmatched: number; created: number; errors: number }> {
  return apiClient<{ matched: number; unmatched: number; created: number; errors: number }>(
    tenantPath(tenantId, `integrations/${integrationId}/sync-users`),
    {
      method: 'POST',
    },
  );
}
