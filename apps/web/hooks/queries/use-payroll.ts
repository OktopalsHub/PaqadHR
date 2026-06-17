'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollRun,
  disbursePayrollRun,
  downloadPayrollBankFile,
  fetchPayrollReadiness,
  fetchPayrollRuns,
  notifyEmployeePaymentSetup,
  processPayrollRun,
  removePayrollItem,
} from '@/lib/api/payroll';
import { queryKeys } from '@/lib/query/keys';
import type { CreatePayrollRunInput } from '@/lib/schemas/payroll';
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
      mutationFn: calculatePayrollRun,
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
