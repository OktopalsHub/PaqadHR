'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePayrollRun,
  approveRetryFunding,
  calculatePayrollRun,
  createPayrollRun,
  createRetryFundingCheckout,
  deletePayrollRun,
  disbursePayrollRun,
  downloadPayrollBankFile,
  fetchMemberPublishedPayslips,
  fetchPayrollFundingLedger,
  fetchPayrollFundingPreflight,
  fetchPayrollReadiness,
  fetchPayrollRun,
  fetchPayrollRuns,
  fetchPayrollSetupSummary,
  fetchRunPayslips,
  fundAndPayPayroll,
  notifyEmployeePaymentSetup,
  notifyMemberPaymentSetup,
  payNowPayroll,
  previewRetryFunding,
  processPayrollRun,
  publishPayslips,
  removePayrollItem,
  reopenPayrollRun,
  retryFailedPayrollPayments,
  schedulePayrollPayout,
  updatePayrollItem,
  updatePayrollRun,
  updatePayrollRunTitle,
} from '@/lib/api/payroll';
import { queryKeys } from '@/lib/query/keys';
import type {
  CreatePayrollRunInput,
  PatchPayrollRunInput,
  PayrollAdjustmentLine,
} from '@/lib/schemas/payroll';
import { useTenant } from '@/providers/tenant-provider';

/**
 * Poll while any run still has items in flight. Bachs payouts settle on `payout.paid`
 * webhooks, and focus-refresh is disabled here, so without polling a failure would not
 * surface until the user reloaded — leaving "Payment in progress" spinning forever.
 */
const PAYROLL_PAYOUT_POLL_MS = 15_000;

export function usePayrollRuns(enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId],
    queryFn: fetchPayrollRuns,
    enabled: enabled && !tenantLoading && Boolean(tenantId),
    refetchInterval: (query) =>
      (query.state.data?.runs ?? []).some((run) => (run.itemCounts?.processing ?? 0) > 0)
        ? PAYROLL_PAYOUT_POLL_MS
        : false,
  });
}

export function useMemberPublishedPayslips(memberId?: string, enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'published-payslips', memberId],
    queryFn: () => fetchMemberPublishedPayslips(memberId!),
    enabled: enabled && !tenantLoading && Boolean(tenantId && memberId),
  });
}

export function usePayrollFundingPreflight(runId?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'funding-preflight', runId],
    queryFn: () => fetchPayrollFundingPreflight(runId!),
    enabled: !tenantLoading && Boolean(tenantId && runId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function usePayrollReadiness(runId?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'readiness', runId],
    queryFn: () => fetchPayrollReadiness(runId!),
    enabled: !tenantLoading && Boolean(tenantId && runId),
  });
}

export function usePayrollSetupSummary(enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'setup-summary'],
    queryFn: fetchPayrollSetupSummary,
    enabled: enabled && !tenantLoading && Boolean(tenantId),
  });
}

export function usePayrollRun(runId?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'run', runId],
    queryFn: () => fetchPayrollRun(runId!),
    enabled: !tenantLoading && Boolean(tenantId && runId),
  });
}

export function useRunPayslips(runId?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'payslips', runId],
    queryFn: () => fetchRunPayslips(runId!),
    enabled: !tenantLoading && Boolean(tenantId && runId),
  });
}

export function usePayrollFundingLedger(runId?: string, enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'funding-ledger', runId],
    queryFn: () => fetchPayrollFundingLedger(runId!),
    enabled: enabled && !tenantLoading && Boolean(tenantId && runId),
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreatePayrollRunInput) => createPayrollRun(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.payroll.all, tenantId],
      });
    },
  });
}

export function useUpdatePayrollRun() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchPayrollRunInput }) =>
      updatePayrollRun(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.payroll.all, tenantId],
      });
    },
  });
}

export function usePayrollActions() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.payroll.all, tenantId],
    });

  return {
    calculate: useMutation({
      mutationFn: ({ id, adjustments }: { id: string; adjustments?: PayrollAdjustmentLine[] }) =>
        calculatePayrollRun(id, adjustments),
      onSuccess: invalidate,
    }),
    updateItem: useMutation({
      mutationFn: ({
        runId,
        itemId,
        adjustmentLines,
      }: {
        runId: string;
        itemId: string;
        adjustmentLines: PayrollAdjustmentLine[];
      }) => updatePayrollItem(runId, itemId, { adjustmentLines }),
      onSuccess: invalidate,
    }),
    publishPayslips: useMutation({
      mutationFn: ({
        runId,
        itemIds,
        sendEmail,
      }: {
        runId: string;
        itemIds?: string[];
        sendEmail?: boolean;
      }) => publishPayslips(runId, { itemIds, sendEmail }),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: approvePayrollRun,
      onSuccess: invalidate,
    }),
    disburse: useMutation({
      mutationFn: disbursePayrollRun,
      onSuccess: invalidate,
    }),
    process: useMutation({
      mutationFn: processPayrollRun,
      onSuccess: invalidate,
    }),
    payNow: useMutation({
      mutationFn: payNowPayroll,
      onSuccess: invalidate,
    }),
    fundAndPay: useMutation({
      mutationFn: fundAndPayPayroll,
      onSuccess: invalidate,
    }),
    retryFailed: useMutation({
      mutationFn: ({ id, itemIds }: { id: string; itemIds?: string[] }) =>
        retryFailedPayrollPayments(id, itemIds),
      onSuccess: invalidate,
    }),
    previewRetryFunding: useMutation({
      mutationFn: ({ id, itemIds }: { id: string; itemIds: string[] }) =>
        previewRetryFunding(id, itemIds),
    }),
    approveRetryFunding: useMutation({
      mutationFn: ({
        id,
        itemIds,
        expectedAmount,
        currency,
      }: {
        id: string;
        itemIds: string[];
        expectedAmount: number;
        currency: string;
      }) => approveRetryFunding(id, itemIds, expectedAmount, currency),
      onSuccess: invalidate,
    }),
    createRetryFundingCheckout: useMutation({
      mutationFn: (id: string) => createRetryFundingCheckout(id),
      onSuccess: invalidate,
    }),
    schedule: useMutation({
      mutationFn: ({ id, paymentDate }: { id: string; paymentDate?: string }) =>
        schedulePayrollPayout(id, paymentDate),
      onSuccess: invalidate,
    }),
    exportCsv: useMutation({
      mutationFn: downloadPayrollBankFile,
    }),
    removeItem: useMutation({
      mutationFn: ({ runId, itemId }: { runId: string; itemId: string }) =>
        removePayrollItem(runId, itemId),
      onSuccess: invalidate,
    }),
    deleteRun: useMutation({
      mutationFn: deletePayrollRun,
      onSuccess: invalidate,
    }),
    updateTitle: useMutation({
      mutationFn: ({ id, title }: { id: string; title: string }) =>
        updatePayrollRunTitle(id, title),
      onSuccess: invalidate,
    }),
    reopen: useMutation({
      mutationFn: reopenPayrollRun,
      onSuccess: invalidate,
    }),
    notifyPaymentSetup: useMutation({
      mutationFn: ({ runId, itemId }: { runId: string; itemId: string }) =>
        notifyEmployeePaymentSetup(runId, itemId),
    }),
    notifyMemberPaymentSetup: useMutation({
      mutationFn: (memberId: string) => notifyMemberPaymentSetup(memberId),
    }),
  };
}
