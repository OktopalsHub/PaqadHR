'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationStream,
} from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

const NOTIFICATIONS_LIMIT = 20;
const UNREAD_POLL_MS = 60_000;

function notificationQueryKeys(tenantId: string | null) {
  return {
    list: [...queryKeys.notifications.list, tenantId] as const,
    unreadCount: [...queryKeys.notifications.unreadCount, tenantId] as const,
  };
}

export function useNotifications(options?: { enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useQuery({
    queryKey: keys.list,
    queryFn: () => fetchNotifications({ limit: NOTIFICATIONS_LIMIT }),
    enabled: (options?.enabled ?? true) && !tenantLoading && Boolean(tenantId),
  });
}

export function useUnreadNotificationCount() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: fetchUnreadNotificationCount,
    enabled: !tenantLoading && Boolean(tenantId),
    refetchInterval: UNREAD_POLL_MS,
  });
}

export function useNotificationStream() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  useEffect(() => {
    if (!tenantId) return;

    const controller = new AbortController();
    const keys = notificationQueryKeys(tenantId);

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    };

    void subscribeToNotificationStream(tenantId, invalidate, controller.signal).catch(() => {
      // Stream disconnects are expected; polling still refreshes the badge.
    });

    return () => controller.abort();
  }, [queryClient, tenantId]);
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}
