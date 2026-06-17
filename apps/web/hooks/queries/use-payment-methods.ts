'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPaymentMethod,
  fetchPaymentMethods,
  fetchPendingPaymentMethods,
  fetchSupportedPaymentCurrencies,
  verifyPaymentMethod,
} from '@/lib/api/payment-methods';
import { queryKeys } from '@/lib/query/keys';
import type { CreatePaymentMethodInput } from '@/lib/schemas/payment-method';
import { useTenant } from '@/providers/tenant-provider';

export function usePaymentMethods() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.paymentMethods.all, tenantId],
    queryFn: fetchPaymentMethods,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useSupportedPaymentCurrencies() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.paymentMethods.currencies, tenantId],
    queryFn: fetchSupportedPaymentCurrencies,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreatePaymentMethodInput) => createPaymentMethod(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.all, tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.pending, tenantId],
      });
    },
  });
}

export function usePendingPaymentMethods() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.paymentMethods.pending, tenantId],
    queryFn: fetchPendingPaymentMethods,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useVerifyPaymentMethod() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      paymentMethodId,
      status,
    }: {
      paymentMethodId: string;
      status: 'verified' | 'rejected';
    }) => verifyPaymentMethod(paymentMethodId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.pending, tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.all, tenantId],
      });
    },
  });
}
