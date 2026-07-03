import { apiClient, fetchWithCsrf, getApiV1Base } from '@/lib/api/client';

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

function tenantHeaders(tenantId: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('x-tenant-id', tenantId);
  return { ...init, headers };
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
  const path = `/notifications${query ? `?${query}` : ''}`;
  return apiClient<NotificationsListResponse>(path, tenantHeaders(tenantId));
}

export async function fetchUnreadNotificationCount(tenantId: string): Promise<number> {
  const result = await apiClient<{ count: number }>(
    '/notifications/unread-count',
    tenantHeaders(tenantId),
  );
  return result.count;
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
): Promise<void> {
  await apiClient(
    `/notifications/${notificationId}/read`,
    tenantHeaders(tenantId, { method: 'PATCH' }),
  );
}

export async function markAllNotificationsRead(tenantId: string): Promise<void> {
  await apiClient('/notifications/read-all', tenantHeaders(tenantId, { method: 'PATCH' }));
}

export async function subscribeToNotificationStream(
  tenantId: string,
  onEvent: () => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetchWithCsrf(`${getApiV1Base()}/notifications/stream`, {
    headers: {
      Accept: 'text/event-stream',
      'x-tenant-id': tenantId,
    },
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
