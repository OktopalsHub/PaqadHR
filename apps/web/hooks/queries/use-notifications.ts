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
  type NotificationsListResponse,
  subscribeToNotificationStream,
} from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query/keys';
import { applyOptimisticUpdate, isLastInFlightMutation } from '@/lib/query/optimistic';
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
  const mutationKey = ['notifications', 'mark-read'] as const;

  return useMutation({
    mutationKey,
    mutationFn: (notificationId: string) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return markNotificationRead(tenantId, notificationId);
    },
    onMutate: async (notificationId) => {
      const readAt = new Date().toISOString();
      const wasUnread = queryClient
        .getQueriesData<NotificationsListResponse>({ queryKey: keys.list })
        .some(([, data]) =>
          data?.notifications.some((item) => item.id === notificationId && !item.readAt),
        );
      const rollbackList = await applyOptimisticUpdate<NotificationsListResponse>(
        queryClient,
        keys.list,
        (data) => ({
          ...data,
          notifications: data.notifications.map((item) =>
            item.id === notificationId ? { ...item, readAt, status: 'read' } : item,
          ),
        }),
      );
      const rollbackCount = wasUnread
        ? await applyOptimisticUpdate<number>(queryClient, keys.unreadCount, (count) =>
            Math.max(0, count - 1),
          )
        : () => undefined;
      return {
        rollback: () => {
          rollbackList();
          rollbackCount();
        },
      };
    },
    onError: (_error, _variables, context) => context?.rollback(),
    onSettled: () => {
      if (!isLastInFlightMutation(queryClient, mutationKey)) return;
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
    mutationKey: ['notifications', 'mark-all-read'],
    mutationFn: () => {
      if (!tenantId) throw new Error('Workspace not selected');
      return markAllNotificationsRead(tenantId);
    },
    onMutate: async () => {
      const readAt = new Date().toISOString();
      const rollbackList = await applyOptimisticUpdate<NotificationsListResponse>(
        queryClient,
        keys.list,
        (data) => ({
          ...data,
          notifications: data.notifications.map((item) =>
            item.readAt ? item : { ...item, readAt, status: 'read' },
          ),
        }),
      );
      const rollbackCount = await applyOptimisticUpdate<number>(
        queryClient,
        keys.unreadCount,
        () => 0,
      );
      return {
        rollback: () => {
          rollbackList();
          rollbackCount();
        },
      };
    },
    onError: (_error, _variables, context) => context?.rollback(),
    onSettled: () => {
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
