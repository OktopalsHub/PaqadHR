'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShoutoutCategory,
  deleteShoutoutCategory,
  fetchShoutoutCategoriesAdmin,
  updateShoutoutCategory,
} from '@/lib/api/shoutout-categories-admin';
import { queryKeys } from '@/lib/query/keys';
import type { ShoutoutCategoryRecord } from '@/lib/api/shoutout-categories-admin';
import { useTenant } from '@/providers/tenant-provider';

export function useShoutoutCategoriesAdmin() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.shoutouts.categories, tenantId],
    queryFn: fetchShoutoutCategoriesAdmin,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateShoutoutCategoryAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: createShoutoutCategory,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [...queryKeys.settings.shoutoutCategories, tenantId] });
      await queryClient.cancelQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });

      const previousCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
      );
      const previousUserCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
      );

      const optimisticCategory: ShoutoutCategoryRecord = {
        id: `temp-${Date.now()}`,
        name: input.name,
        color: input.color ?? null,
        isActive: true,
      };

      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
        (old) => [...(old ?? []), optimisticCategory],
      );
      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
        (old) => [...(old ?? []), optimisticCategory],
      );

      return { previousCategories, previousUserCategories };
    },
    onError: (_err, _input, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          [...queryKeys.settings.shoutoutCategories, tenantId],
          context.previousCategories,
        );
      }
      if (context?.previousUserCategories) {
        queryClient.setQueryData(
          [...queryKeys.shoutouts.categories, tenantId],
          context.previousUserCategories,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });
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
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: [...queryKeys.settings.shoutoutCategories, tenantId] });
      await queryClient.cancelQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });

      const previousCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
      );
      const previousUserCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
      );

      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
        (old) =>
          old?.map((cat) =>
            cat.id === id ? { ...cat, ...input } : cat,
          ),
      );
      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
        (old) =>
          old?.map((cat) =>
            cat.id === id ? { ...cat, ...input } : cat,
          ),
      );

      return { previousCategories, previousUserCategories };
    },
    onError: (_err, _input, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          [...queryKeys.settings.shoutoutCategories, tenantId],
          context.previousCategories,
        );
      }
      if (context?.previousUserCategories) {
        queryClient.setQueryData(
          [...queryKeys.shoutouts.categories, tenantId],
          context.previousUserCategories,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });
    },
  });
}

export function useDeleteShoutoutCategoryAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: deleteShoutoutCategory,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [...queryKeys.settings.shoutoutCategories, tenantId] });
      await queryClient.cancelQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });

      const previousCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
      );
      const previousUserCategories = queryClient.getQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
      );

      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.settings.shoutoutCategories, tenantId],
        (old) => old?.filter((cat) => cat.id !== id),
      );
      queryClient.setQueryData<ShoutoutCategoryRecord[]>(
        [...queryKeys.shoutouts.categories, tenantId],
        (old) => old?.filter((cat) => cat.id !== id),
      );

      return { previousCategories, previousUserCategories };
    },
    onError: (_err, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          [...queryKeys.settings.shoutoutCategories, tenantId],
          context.previousCategories,
        );
      }
      if (context?.previousUserCategories) {
        queryClient.setQueryData(
          [...queryKeys.shoutouts.categories, tenantId],
          context.previousUserCategories,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.shoutoutCategories, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.shoutouts.categories, tenantId] });
    },
  });
}
