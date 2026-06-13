"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createShoutout,
  fetchShoutoutCategories,
  fetchShoutouts,
} from "@/lib/api/shoutouts";
import type { CreateShoutoutInput } from "@/lib/schemas/shoutout";
import { queryKeys } from "@/lib/query/keys";
import { useTenant } from "@/providers/tenant-provider";

export function useShoutouts() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.shoutouts.all, tenantId],
    queryFn: () => fetchShoutouts({ limit: 50 }),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useShoutoutCategories() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.shoutouts.categories, tenantId],
    queryFn: fetchShoutoutCategories,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateShoutout() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateShoutoutInput) => createShoutout(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.shoutouts.all, tenantId],
      });
    },
  });
}
