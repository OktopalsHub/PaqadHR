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

export async function fetchSlackChannels(integrationId: string): Promise<SlackChannel[]> {
  const data = await apiClient<SlackChannel[] | { channels: SlackChannel[] }>(
    `/integrations/${integrationId}/channels`,
  );
  return Array.isArray(data) ? data : (data.channels ?? []);
}

export async function setupShoutoutChannel(
  integrationId: string,
  platformChannelId: string,
  platformChannelName: string,
): Promise<{
  success: boolean;
  message: string;
  testMessageSent?: boolean;
  testMessageError?: string;
}> {
  return apiClient(`/integrations/${integrationId}/setup-channel`, {
    method: 'POST',
    body: JSON.stringify({ platformChannelId, platformChannelName }),
  });
}
