'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShoutoutCategory,
  deleteShoutoutCategory,
  fetchShoutoutCategoriesAdmin,
  updateShoutoutCategory,
} from '@/lib/api/shoutout-categories-admin';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useShoutoutCategoriesAdmin() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
    queryFn: fetchShoutoutCategoriesAdmin,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateShoutoutCategoryAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: createShoutoutCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.categories });
    },
  });
}

export function useUpdateShoutoutCategoryAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateShoutoutCategory>[1];
    }) => updateShoutoutCategory(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.categories });
    },
  });
}

export function useDeleteShoutoutCategoryAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: deleteShoutoutCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.categories });
    },
  });
}
