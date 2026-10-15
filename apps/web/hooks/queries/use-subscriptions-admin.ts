'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ActivateTenantSubscriptionInput,
  activateTenantSubscription,
  extendTenantTrial,
} from '@/lib/api/subscriptions';
import { queryKeys } from '@/lib/query/keys';

export function useActivateTenantSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tenantId,
      input,
    }: {
      tenantId: string;
      input: ActivateTenantSubscriptionInput;
    }) => activateTenantSubscription(tenantId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.status('') });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useExtendTenantTrial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, additionalDays }: { tenantId: string; additionalDays: number }) =>
      extendTenantTrial(tenantId, additionalDays),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.status('') });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}
