'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  type BroadcastNotificationInput,
  broadcastNotification,
  deleteNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationStream,
} from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query/keys';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';

const NOTIFICATIONS_LIMIT = 20;
const UNREAD_POLL_MS = 60_000;

function notificationQueryKeys(tenantId: string | null) {
  return {
    list: [...queryKeys.notifications.list, tenantId] as const,
    unreadCount: [...queryKeys.notifications.unreadCount, tenantId] as const,
  };
}

function notificationsEnabled(
  tenantId: string | null,
  tenantLoading: boolean,
  authLoading: boolean,
  isAuthenticated: boolean,
  enabled = true,
) {
  return enabled && !tenantLoading && !authLoading && isAuthenticated && Boolean(tenantId);
}

export function useNotifications(options?: { enabled?: boolean; limit?: number }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const keys = notificationQueryKeys(tenantId);
  const limit = options?.limit ?? NOTIFICATIONS_LIMIT;

  return useQuery({
    queryKey: [...keys.list, limit] as const,
    queryFn: () => fetchNotifications(tenantId!, { limit }),
    enabled: notificationsEnabled(
      tenantId,
      tenantLoading,
      authLoading,
      isAuthenticated,
      options?.enabled ?? true,
    ),
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useUnreadNotificationCount() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const keys = notificationQueryKeys(tenantId);

  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => fetchUnreadNotificationCount(tenantId!),
    enabled: notificationsEnabled(tenantId, tenantLoading, authLoading, isAuthenticated),
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useNotificationStream() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!tenantId || authLoading || !isAuthenticated) return;

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
  }, [queryClient, tenantId, isAuthenticated, authLoading]);
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useMutation({
    mutationFn: (notificationId: string) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return markNotificationRead(tenantId, notificationId);
    },
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
    mutationFn: () => {
      if (!tenantId) throw new Error('Workspace not selected');
      return markAllNotificationsRead(tenantId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

export function useBroadcastNotification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useMutation({
    mutationFn: (input: BroadcastNotificationInput) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return broadcastNotification(tenantId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const keys = notificationQueryKeys(tenantId);

  return useMutation({
    mutationFn: (notificationId: string) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return deleteNotification(tenantId, notificationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}
