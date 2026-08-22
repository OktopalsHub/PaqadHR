import { apiClient, getApiV1Base } from '@/lib/api/client';

export type NotificationType = 'system' | 'tenant' | 'user';
export type NotificationChannel = 'email' | 'in_app' | 'both';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  actionData?: {
    url?: string;
    buttonText?: string;
    actionType?: string;
  } | null;
  tenantId?: string | null;
  recipientId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: AppNotification[];
  total: number;
}

export async function fetchNotifications(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  },
): Promise<NotificationsListResponse> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));
  if (options?.unreadOnly) params.set('unreadOnly', 'true');
  const query = params.toString();
  const path = `/tenants/${tenantId}/notifications${query ? `?${query}` : ''}`;
  return apiClient<NotificationsListResponse>(path);
}

export async function fetchUnreadNotificationCount(tenantId: string): Promise<number> {
  const result = await apiClient<{ count: number }>(
    `/tenants/${tenantId}/notifications/unread-count`,
  );
  return result.count;
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
): Promise<void> {
  await apiClient(`/tenants/${tenantId}/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(tenantId: string): Promise<void> {
  await apiClient(`/tenants/${tenantId}/notifications/read-all`, { method: 'PATCH' });
}

export async function deleteNotification(tenantId: string, notificationId: string): Promise<void> {
  await apiClient(`/tenants/${tenantId}/notifications/${notificationId}`, { method: 'DELETE' });
}

export interface BroadcastNotificationInput {
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  channel?: 'in_app' | 'both';
}

export async function broadcastNotification(
  tenantId: string,
  input: BroadcastNotificationInput,
): Promise<{ success: boolean; recipients: number }> {
  return apiClient<{ success: boolean; recipients: number }>(
    `/tenants/${tenantId}/notifications/broadcast`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export async function subscribeToNotificationStream(
  tenantId: string,
  onEvent: () => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${getApiV1Base()}/tenants/${tenantId}/notifications/stream`, {
    headers: {
      Accept: 'text/event-stream',
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;

      try {
        const payload = JSON.parse(dataLine.slice(6)) as { type?: string };
        if (payload.type !== 'heartbeat') {
          onEvent();
        }
      } catch {}
    }
  }
}
