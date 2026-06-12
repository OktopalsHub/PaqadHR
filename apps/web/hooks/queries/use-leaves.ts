"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLeave,
  fetchLeaves,
  fetchMyLeaveBalances,
} from "@/lib/api/leaves";
import type { CreateLeaveInput } from "@/lib/schemas/leave";
import { queryKeys } from "@/lib/query/keys";
import { useTenant } from "@/providers/tenant-provider";

export function useLeaves() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.all, tenantId],
    queryFn: fetchLeaves,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useLeaveBalances() {
  return useQuery({
    queryKey: queryKeys.leaves.balances,
    queryFn: fetchMyLeaveBalances,
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveInput) => createLeave(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.balances,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events,
      });
    },
  });
}
