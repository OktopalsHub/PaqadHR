'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePaymentMethodInput } from '@/lib/api/payment-methods';
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchNigerianBanks,
  fetchPaymentMethods,
  fetchPendingPaymentMethods,
  fetchSupportedPaymentCurrencies,
  lookupNigerianBankAccount,
  submitPaymentMethodForVerification,
  updatePaymentMethod,
  verifyPaymentMethod,
} from '@/lib/api/payment-methods';
import { changePaymentPasscode, fetchPaymentPasscodeStatus } from '@/lib/api/payment-security';
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

export function usePaymentPasscodeStatus() {
  const { tenantId, tenant, isLoading: tenantLoading } = useTenant();
  const memberId = tenant?.member?.id;

  return useQuery({
    queryKey: [...queryKeys.paymentMethods.passcodeStatus, tenantId, memberId],
    queryFn: () => fetchPaymentPasscodeStatus(memberId!),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(memberId),
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
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.passcodeStatus, tenantId],
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
      notes,
    }: {
      paymentMethodId: string;
      status: 'verified' | 'rejected';
      notes?: string;
    }) => verifyPaymentMethod(paymentMethodId, status, notes),
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

export function useSubmitPaymentMethodForVerification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      paymentMethodId,
      passcode,
      otpProof,
    }: {
      paymentMethodId: string;
      passcode: string;
      otpProof: string;
    }) => submitPaymentMethodForVerification(paymentMethodId, passcode, otpProof),
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

export function useNigerianBanks(options?: { enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.paymentMethods.banks(tenantId ?? ''),
    queryFn: fetchNigerianBanks,
    enabled: (options?.enabled ?? false) && !tenantLoading && Boolean(tenantId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

export function useBankLookup() {
  return useMutation({
    mutationFn: (input: { accountNumber: string; bankCode: string; bankName?: string }) =>
      lookupNigerianBankAccount(input),
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      paymentMethodId,
      input,
    }: {
      paymentMethodId: string;
      input: UpdatePaymentMethodInput;
    }) => updatePaymentMethod(paymentMethodId, input),
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

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ paymentMethodId, passcode }: { paymentMethodId: string; passcode?: string }) =>
      deletePaymentMethod(paymentMethodId, passcode),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.all, tenantId],
      });
    },
  });
}

export function useChangePaymentPasscode() {
  const queryClient = useQueryClient();
  const { tenantId, tenant } = useTenant();
  const memberId = tenant?.member?.id;

  return useMutation({
    mutationFn: ({
      currentPasscode,
      newPasscode,
    }: {
      currentPasscode: string;
      newPasscode: string;
    }) => {
      if (!memberId) throw new Error('Member not found');
      return changePaymentPasscode(memberId, currentPasscode, newPasscode);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.paymentMethods.passcodeStatus, tenantId],
      });
    },
  });
}
