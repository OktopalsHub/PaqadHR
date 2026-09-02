'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollRun,
  disbursePayrollRun,
  downloadPayrollBankFile,
  fetchPayrollReadiness,
  fetchPayrollRun,
  fetchPayrollRuns,
  fetchPayrollSetupSummary,
  fetchRunPayslips,
  notifyEmployeePaymentSetup,
  payNowPayroll,
  processPayrollRun,
  publishPayslips,
  removePayrollItem,
  schedulePayrollPayout,
  updatePayrollItem,
} from '@/lib/api/payroll';
import { queryKeys } from '@/lib/query/keys';
import type { CreatePayrollRunInput, PayrollAdjustmentLine } from '@/lib/schemas/payroll';
import { useTenant } from '@/providers/tenant-provider';

export function usePayrollRuns() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId],
    queryFn: fetchPayrollRuns,
    enabled: !tenantLoading && Boolean(tenantId),
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
    notifyPaymentSetup: useMutation({
      mutationFn: ({ runId, itemId }: { runId: string; itemId: string }) =>
        notifyEmployeePaymentSetup(runId, itemId),
    }),
  };
}
