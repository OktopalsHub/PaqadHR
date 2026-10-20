'use client';

import { Lock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/person-avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditPayrollRunDialog } from '@/features/payroll/components/edit-payroll-run-dialog';
import { formatAdjustmentLineLabel } from '@/features/payroll/lib/format-adjustment-line';
import { toastPayrollPayoutResult } from '@/features/payroll/toast-payroll-payout';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useCurrentSalaries } from '@/hooks/queries/use-employment';
import {
  usePayrollActions,
  usePayrollFundingLedger,
  usePayrollRun,
  usePayrollSetupSummary,
  useRunPayslips,
} from '@/hooks/queries/use-payroll';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import { canManageMember } from '@/lib/auth/manager-access';
import { openCheckoutUrlWithOptionalTab } from '@/lib/bachs-checkout';
import { formatDate } from '@/lib/format-date';
import { isPayrollFundingPending } from '@/lib/payroll-funding';
import type {
  PayrollAdjustmentLine,
  PayrollItem,
  PayrollRunDetail as PayrollRunDetailType,
} from '@/lib/schemas/payroll';
import { useTenant } from '@/providers/tenant-provider';

const ADJUSTMENT_TYPES = [
  { value: 'bonus', label: 'Bonus' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'commission', label: 'Commission' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'penalty', label: 'Penalty' },
];

function getPayrollStatusStyles(status: string) {
  const key = status.toLowerCase();
  switch (key) {
    case 'completed':
    case 'published':
    case 'paid':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400';
    case 'processing':
    case 'approved':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400';
    case 'draft':
    case 'unpublished':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
  }
}

function getPayrollStatusDotClass(status: string) {
  const key = status.toLowerCase();
  switch (key) {
    case 'completed':
    case 'published':
    case 'paid':
      return 'bg-green-500';
    case 'processing':
    case 'approved':
      return 'bg-blue-500';
    case 'failed':
      return 'bg-red-500';
    case 'draft':
    case 'unpublished':
      return 'bg-amber-500';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
  }
}

function payrollStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'Paid';
    case 'processing':
      return 'Ready to approve';
    case 'approved':
      return 'Approved';
    case 'failed':
      return 'Failed';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

function employeeName(item: PayrollItem) {
  const employee = item.employee;
  if (!employee) return item.memberId;
  return `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || item.memberId;
}

function BonusDialog({
  item,
  runId,
  currency,
  onSaved,
}: {
  item: PayrollItem;
  runId: string;
  currency: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('bonus');
  const [method, setMethod] = useState<'fixed_amount' | 'percentage'>('fixed_amount');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const actions = usePayrollActions();

  const existingLines =
    (item.metadata?.adjustmentLines as PayrollAdjustmentLine[] | undefined) ?? [];

  const handleSave = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const line: PayrollAdjustmentLine = {
      employeeId: item.memberId,
      type,
      method,
      value: amount,
      reason: reason.trim(),
    };

    try {
      await actions.updateItem.mutateAsync({
        runId,
        itemId: item.id,
        adjustmentLines: [...existingLines, line],
      });
      toast.success('Adjustment added');
      setOpen(false);
      setValue('');
      setReason('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save adjustment');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          <Plus className="mr-1 size-3.5" />
          Add bonus
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add adjustment — {employeeName(item)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as 'fixed_amount' | 'percentage')}
              >
                <SelectTrigger className="w-full border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_amount">Fixed ({currency})</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
            />
          </div>
          <Button
            variant="brandSolid"
            className="w-full"
            disabled={actions.updateItem.isPending}
            onClick={handleSave}
          >
            Save adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollRunDetail({
  runId,
  payrollGatewayEnabled,
  isAdmin,
  onDelete,
  onReopen,
}: {
  runId: string;
  payrollGatewayEnabled: boolean;
  isAdmin: boolean;
  onDelete?: () => void;
  onReopen?: () => void;
}) {
  const { data: run, isLoading, refetch } = usePayrollRun(runId);
  const { data: employees = [] } = useEmployees();
  const { data: currentSalaries = [] } = useCurrentSalaries(isAdmin);
  const { data: setupSummary } = usePayrollSetupSummary(isAdmin);
  const { data: tenantSettings } = useTenantSettings();
  const { data: payslips = [] } = useRunPayslips(
    isAdmin && run?.status === 'completed' ? runId : undefined,
  );
  const actions = usePayrollActions();
  const [sendEmail, setSendEmail] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { tenant } = useTenant();
  const viewerMemberId = tenant?.member?.id;
  const viewerRole = tenant?.member?.role;

  const paymentReadyMemberIds = useMemo(
    () => new Set(setupSummary?.readyMemberIds ?? []),
    [setupSummary?.readyMemberIds],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'Active'),
    [employees],
  );

  const canManagePayrollItem = (memberId: string) => {
    if (isAdmin) {
      return true;
    }
    if (!viewerMemberId) {
      return false;
    }
    const employee = employees.find((entry) => entry.id === memberId);
    return employee ? canManageMember(viewerMemberId, employee, viewerRole) : false;
  };

  useEffect(() => {
    setSendEmail(tenantSettings?.settings?.general?.emailPayslipOnPublish ?? false);
  }, [tenantSettings?.settings?.general?.emailPayslipOnPublish]);

  const detail = run as PayrollRunDetailType | undefined;
  const retryFundingMeta =
    detail?.metadata?.retryFunding && typeof detail.metadata.retryFunding === 'object'
      ? (detail.metadata.retryFunding as Record<string, unknown>)
      : undefined;
  const floatTopupMeta =
    detail?.metadata?.floatTopup && typeof detail.metadata.floatTopup === 'object'
      ? (detail.metadata.floatTopup as Record<string, unknown>)
      : undefined;
  const isBachsFundingRun =
    String(floatTopupMeta?.provider ?? '').toLowerCase() === 'bachs' ||
    String(retryFundingMeta?.provider ?? '').toLowerCase() === 'bachs' ||
    (detail?.items ?? []).some((item) =>
      (item.paymentProvider ?? '').toLowerCase().includes('bachs'),
    );
  // The last verified retry-funding selection, if any (sorted for set comparison).
  const verifiedRetryFundingItemIds = Array.isArray(retryFundingMeta?.selectedItemIds)
    ? (retryFundingMeta.selectedItemIds as string[]).slice().sort()
    : [];
  const retryFundingAwaitingVerification = retryFundingMeta?.status === 'pending';
  const fundingLedgerQuery = usePayrollFundingLedger(runId, Boolean(isAdmin && isBachsFundingRun));
  const [showAllFundingLedgerEntries, setShowAllFundingLedgerEntries] = useState(false);
  const [retryFundingReviewOpen, setRetryFundingReviewOpen] = useState(false);
  const [retryFundingItemIds, setRetryFundingItemIds] = useState<string[]>([]);
  const [retryFundingPreview, setRetryFundingPreview] = useState<{
    amount: number;
    requiredAmount?: number;
    balanceApplied?: number;
    availableBalance?: number | null;
    currency: string;
    selectedItemIds: string[];
    platformFee: 0;
    payoutFeeReserve: number;
  } | null>(null);
  const [retryFundingApproved, setRetryFundingApproved] = useState(false);
  const isDraft = detail?.status === 'draft';
  const isLocked =
    detail?.status === 'approved' || detail?.status === 'completed' || detail?.status === 'failed';
  const canEditTitle = Boolean(
    isAdmin && detail && (detail.status === 'draft' || detail.status === 'processing'),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [payNowConfirmOpen, setPayNowConfirmOpen] = useState(false);

  useEffect(() => {
    if (detail?.title) {
      setTitleDraft(detail.title);
    }
  }, [detail?.title]);

  const activeItems = useMemo(
    () => (detail?.items ?? []).filter((item) => item.status !== 'cancelled'),
    [detail?.items],
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const visibleItems = useMemo(
    () =>
      statusFilter === 'all'
        ? activeItems
        : activeItems.filter((item) => item.status.toLowerCase() === statusFilter),
    [activeItems, statusFilter],
  );

  const hasPaidOrInFlight = activeItems.some(
    (item) => item.status === 'paid' || item.status === 'processing',
  );
  const canDelete = Boolean(
    detail && detail.status !== 'completed' && onDelete && !hasPaidOrInFlight,
  );
  const hasFailedItems = activeItems.some((item) => item.status === 'failed');
  const paymentCounts = useMemo(() => {
    const sum = (items: PayrollItem[]) =>
      items.reduce((total, item) => total + Number(item.netAmount ?? 0), 0);
    const paid = activeItems.filter((item) => item.status === 'paid');
    const failed = activeItems.filter((item) => item.status === 'failed');
    const pending = activeItems.filter((item) => item.status === 'pending');
    const processing = activeItems.filter((item) => item.status === 'processing');
    return {
      total: activeItems.length,
      paidCount: paid.length,
      failedCount: failed.length,
      pendingCount: pending.length,
      processingCount: processing.length,
      paidAmount: sum(paid),
      failedAmount: sum(failed),
      pendingAmount: sum([...pending, ...processing]),
      expectedAmount: sum(activeItems),
    };
  }, [activeItems]);
  const formatMoney = (amount: number, currency = detail?.baseCurrency ?? '') =>
    `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  const hasPendingItems = activeItems.some((item) => item.status === 'pending');
  const hasInFlightItems = activeItems.some((item) => item.status === 'processing');
  const fundingPending = isPayrollFundingPending(detail?.metadata);
  const canReopen =
    Boolean(isAdmin && detail?.status === 'processing' && onReopen) && !hasPaidOrInFlight;
  const canRetry =
    Boolean(isAdmin && payrollGatewayEnabled) &&
    hasFailedItems &&
    (detail?.status === 'failed' ||
      detail?.status === 'processing' ||
      detail?.status === 'approved');

  // Retry funding already verified for exactly the run's current failed payouts: retrying pays
  // them, and nothing may be funded again.
  const currentFailedItemIds = activeItems
    .filter((item) => item.status === 'failed')
    .map((item) => item.id)
    .sort();
  const retryFundingVerifiedForFailedItems =
    retryFundingMeta?.status === 'funded' &&
    verifiedRetryFundingItemIds.length > 0 &&
    verifiedRetryFundingItemIds.length === currentFailedItemIds.length &&
    verifiedRetryFundingItemIds.every((id, index) => id === currentFailedItemIds[index]);
  const retryRunLabel =
    isBachsFundingRun && !retryFundingVerifiedForFailedItems
      ? 'Review retry funding'
      : 'Retry payment';
  // A failed payout that a verified funding round already covers must be paid, not funded again.
  const retryItemLabel = (itemId: string) =>
    isBachsFundingRun && !verifiedRetryFundingItemIds.includes(itemId) ? 'Review funding' : 'Retry';

  const busy =
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.process.isPending ||
    actions.payNow.isPending ||
    actions.fundAndPay.isPending ||
    actions.retryFailed.isPending ||
    actions.previewRetryFunding.isPending ||
    actions.approveRetryFunding.isPending ||
    actions.createRetryFundingCheckout.isPending ||
    actions.reconcileRetryFunding.isPending ||
    actions.schedule.isPending ||
    actions.publishPayslips.isPending ||
    actions.reopen.isPending ||
    actions.updateTitle.isPending;

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  useEffect(() => {
    if (detail?.paymentDate) {
      setScheduleDate(String(detail.paymentDate).slice(0, 10));
    }
  }, [detail?.paymentDate]);

  const handleCalculate = async () => {
    try {
      const result = await actions.calculate.mutateAsync({ id: runId });
      await refetch();
      if (result.warnings?.length) {
        toast.warning(`${result.warnings.length} employee(s) need payment settings`);
      } else {
        toast.success('Payroll calculated');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Calculate failed');
    }
  };

  const handlePayNow = async () => {
    const checkoutTab = window.open('about:blank', '_blank');
    try {
      const response = await actions.fundAndPay.mutateAsync(runId);
      if (response.action === 'checkout') {
        if (response.checkoutUrl) {
          toast.message(
            response.preflight?.message ??
              'Complete checkout as your company — we then pay each employee automatically',
          );
          await openCheckoutUrlWithOptionalTab(response.checkoutUrl, checkoutTab);
        } else {
          checkoutTab?.close();
          toast.error(response.preflight?.message ?? 'Fund the payout provider, then retry');
        }
        setPayNowConfirmOpen(false);
        await refetch();
        return;
      }
      checkoutTab?.close();
      toastPayrollPayoutResult(response.result, 'pay');
      setPayNowConfirmOpen(false);
      await refetch();
    } catch (err) {
      checkoutTab?.close();
      toast.error(err instanceof Error ? err.message : 'Payout failed');
      await refetch();
    }
  };

  const handleRetryFailed = async (itemIds?: string[]) => {
    if (isBachsFundingRun) {
      const selectedItemIds = (
        itemIds?.length
          ? itemIds
          : activeItems.filter((item) => item.status === 'failed').map((item) => item.id)
      )
        .slice()
        .sort();
      if (selectedItemIds.length === 0) {
        toast.error('Select at least one failed payout');
        return;
      }
      const existingSelectedIds = Array.isArray(retryFundingMeta?.selectedItemIds)
        ? (retryFundingMeta.selectedItemIds as string[]).slice().sort()
        : [];
      const existingStatus = retryFundingMeta?.status;
      const existingCheckoutAmount = Number(
        retryFundingMeta?.checkoutAmount ?? retryFundingMeta?.amount ?? 0,
      );
      const existingRequiredAmount = Number(retryFundingMeta?.amount ?? 0);
      if (
        existingStatus === 'funded' &&
        existingSelectedIds.length > 0 &&
        selectedItemIds.every((id) => existingSelectedIds.includes(id))
      ) {
        // Funding for these payouts is already verified and paid: pay them out instead of quoting
        // a new shortfall (which would charge the company a second time). Retry only the payouts
        // the user actually selected — the backend accepts any subset of the funded selection.
        try {
          const response = await actions.retryFailed.mutateAsync({
            id: runId,
            itemIds: selectedItemIds,
          });
          toastPayrollPayoutResult(response.result, 'retry');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Retry failed');
        } finally {
          await refetch();
        }
        return;
      }
      if (
        (existingStatus === 'approved' || existingStatus === 'pending') &&
        existingSelectedIds.length === selectedItemIds.length &&
        existingSelectedIds.every((id, index) => id === selectedItemIds[index]) &&
        existingRequiredAmount > 0 &&
        Number.isFinite(existingCheckoutAmount) &&
        typeof retryFundingMeta?.currency === 'string'
      ) {
        setRetryFundingItemIds(selectedItemIds);
        setRetryFundingPreview({
          amount: existingCheckoutAmount,
          requiredAmount: existingRequiredAmount,
          balanceApplied: Number(retryFundingMeta.balanceApplied ?? 0),
          availableBalance:
            typeof retryFundingMeta.availableBalance === 'number'
              ? retryFundingMeta.availableBalance
              : null,
          currency: String(retryFundingMeta.currency),
          selectedItemIds,
          platformFee: 0,
          payoutFeeReserve: Number(retryFundingMeta.payoutFeeReserve ?? 0),
        });
        setRetryFundingApproved(true);
        setRetryFundingReviewOpen(true);
        return;
      }
      try {
        const preview = await actions.previewRetryFunding.mutateAsync({
          id: runId,
          itemIds: selectedItemIds,
        });
        setRetryFundingItemIds(selectedItemIds);
        setRetryFundingPreview(preview);
        setRetryFundingApproved(false);
        setRetryFundingReviewOpen(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not price retry funding');
        await refetch();
      }
      return;
    }

    try {
      const response = await actions.retryFailed.mutateAsync({ id: runId, itemIds });
      toastPayrollPayoutResult(response.result, 'retry');
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      // The backend is authoritative about the payout provider. Older or incomplete run
      // metadata can make the UI miss a Bachs-backed run, so route this specific guard
      // response into the safe funding-review flow rather than asking the user to retry
      // the same blocked endpoint again.
      if (message.includes('Bachs retry requires approved, provider-verified run-scoped funding')) {
        try {
          const selectedItemIds = (
            itemIds?.length
              ? itemIds
              : activeItems.filter((item) => item.status === 'failed').map((item) => item.id)
          )
            .slice()
            .sort();
          const preview = await actions.previewRetryFunding.mutateAsync({
            id: runId,
            itemIds: selectedItemIds,
          });
          setRetryFundingItemIds(selectedItemIds);
          setRetryFundingPreview(preview);
          setRetryFundingApproved(false);
          setRetryFundingReviewOpen(true);
          await refetch();
          return;
        } catch (previewError) {
          // The run may already hold an active or already-funded retry approval (the UI failed to
          // classify the run as Bachs, or the failed set changed after funding). Surface that
          // approval in the review dialog so the user can verify it instead of dead-ending on a
          // toast that asks them to do something the dialog is the only place to do.
          const existingIds = Array.isArray(retryFundingMeta?.selectedItemIds)
            ? (retryFundingMeta.selectedItemIds as string[]).slice().sort()
            : [];
          const existingCurrency =
            typeof retryFundingMeta?.currency === 'string' ? retryFundingMeta.currency : null;
          const existingAmount = Number(retryFundingMeta?.amount ?? 0);
          if (existingIds.length > 0 && existingCurrency && existingAmount > 0) {
            setRetryFundingItemIds(existingIds);
            setRetryFundingPreview({
              amount: Number(retryFundingMeta?.checkoutAmount ?? existingAmount),
              requiredAmount: existingAmount,
              balanceApplied: Number(retryFundingMeta?.balanceApplied ?? 0),
              availableBalance:
                typeof retryFundingMeta?.availableBalance === 'number'
                  ? retryFundingMeta.availableBalance
                  : null,
              currency: existingCurrency,
              selectedItemIds: existingIds,
              platformFee: 0,
              payoutFeeReserve: Number(retryFundingMeta?.payoutFeeReserve ?? 0),
            });
            setRetryFundingApproved(
              retryFundingMeta?.status === 'approved' || retryFundingMeta?.status === 'funded',
            );
            setRetryFundingReviewOpen(true);
            toast.message('This run already has retry funding. Verify it before retrying.');
            await refetch();
            return;
          }
          toast.error(
            previewError instanceof Error
              ? previewError.message
              : 'Could not prepare the required Bachs retry funding',
          );
          await refetch();
          return;
        }
      }
      toast.error(message);
      await refetch();
    }
  };

  const confirmRetryFunding = async () => {
    if (!retryFundingPreview) return;
    const checkoutTab = window.open('about:blank', '_blank');
    let approvalRecorded = retryFundingApproved;
    try {
      if (!retryFundingApproved) {
        const approval = await actions.approveRetryFunding.mutateAsync({
          id: runId,
          itemIds: retryFundingItemIds,
          expectedAmount: retryFundingPreview.amount,
          currency: retryFundingPreview.currency,
        });
        approvalRecorded = true;
        setRetryFundingApproved(true);
        // The provider balance already covers the retry: the backend credits it to the run and
        // marks the funding verified, so skip checkout and pay the run's failed items now.
        if (Number(approval.amount) <= 0) {
          checkoutTab?.close();
          setRetryFundingReviewOpen(false);
          await refetch();
          await fundingLedgerQuery.refetch();
          toast.success('Your provider balance covers these payouts. Retrying them now.');
          const response = await actions.retryFailed.mutateAsync({
            id: runId,
            itemIds: retryFundingItemIds,
          });
          toastPayrollPayoutResult(response.result, 'retry');
          await refetch();
          return;
        }
      }
      const checkout = await actions.createRetryFundingCheckout.mutateAsync(runId);
      if (Number(checkout.amount) <= 0) {
        checkoutTab?.close();
        setRetryFundingReviewOpen(false);
        await refetch();
        await fundingLedgerQuery.refetch();
        toast.success('Your provider balance covers these payouts. Retrying them now.');
        const response = await actions.retryFailed.mutateAsync({
          id: runId,
          itemIds: retryFundingItemIds,
        });
        toastPayrollPayoutResult(response.result, 'retry');
        await refetch();
        return;
      }
      if (!checkout.checkoutUrl) {
        checkoutTab?.close();
        toast.error('Checkout URL was not returned. You can continue checkout from this dialog.');
        return;
      }
      await openCheckoutUrlWithOptionalTab(checkout.checkoutUrl, checkoutTab, {
        // The overlay can complete before the collection webhook lands. Reconciling here proves
        // the credit server-to-server, so the run unlocks without the user having to guess.
        onCompleted: () => {
          void actions.reconcileRetryFunding
            .mutateAsync(runId)
            .then(() => refetch())
            .catch(() => undefined);
        },
      });
      setRetryFundingReviewOpen(false);
      toast.message(
        `Complete the company-funded retry checkout for ${checkout.amount.toLocaleString()} ${checkout.currency}. Employee payouts will not start until you retry after funding is verified.`,
      );
      await refetch();
      await fundingLedgerQuery.refetch();
    } catch (err) {
      checkoutTab?.close();
      if (approvalRecorded) setRetryFundingApproved(true);
      const message = err instanceof Error ? err.message : 'Retry funding checkout failed';
      if (message.includes('quote changed after preview')) {
        try {
          const preview = await actions.previewRetryFunding.mutateAsync({
            id: runId,
            itemIds: retryFundingItemIds,
          });
          setRetryFundingPreview(preview);
          setRetryFundingApproved(false);
          toast.warning('The payout quote changed. Review the updated amount before approving.');
        } catch (previewError) {
          toast.error(
            previewError instanceof Error ? previewError.message : 'Could not refresh the quote',
          );
        }
      } else {
        toast.error(message);
      }
      await refetch();
    }
  };

  /**
   * Re-verify a completed-but-unverified retry funding checkout with the payout provider, then
   * pay the funded payouts. This is the recovery path when the funding webhook never landed.
   */
  const verifyRetryFunding = async () => {
    try {
      const result = await actions.reconcileRetryFunding.mutateAsync(runId);
      await refetch();
      await fundingLedgerQuery.refetch();
      if (result.status === 'funded') {
        toast.success('Retry funding verified with the payout provider.');
        setRetryFundingReviewOpen(false);
        await handleRetryFailed(retryFundingItemIds.length > 0 ? retryFundingItemIds : undefined);
        return;
      }
      toast.message(
        result.status === 'pending'
          ? 'The provider has not confirmed this payment yet. Finish the checkout, then verify again.'
          : 'There is no pending retry funding checkout to verify.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not verify retry funding');
      await refetch();
    }
  };

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!detail || next.length < 3) {
      toast.error('Title must be at least 3 characters');
      setTitleDraft(detail?.title ?? '');
      setEditingTitle(false);
      return;
    }
    if (next === detail.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await actions.updateTitle.mutateAsync({ id: runId, title: next });
      setEditingTitle(false);
      toast.success('Title updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update title');
      setTitleDraft(detail.title);
      setEditingTitle(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      toast.error('Pick a payment date');
      return;
    }
    try {
      await actions.schedule.mutateAsync({
        id: runId,
        paymentDate: new Date(scheduleDate).toISOString(),
      });
      setScheduleOpen(false);
      toast.success(`Scheduled for ${formatDate(scheduleDate)}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Schedule failed');
    }
  };

  const handlePublishAll = async () => {
    try {
      const unpublished = payslips.filter((p) => !p.published && canManagePayrollItem(p.memberId));
      if (!unpublished.length) {
        toast.error('No payslips available to publish');
        return;
      }
      await actions.publishPayslips.mutateAsync({
        runId,
        itemIds: unpublished.map((p) => p.itemId),
        sendEmail,
      });
      toast.success('Payslips published to employees');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    }
  };

  if (isLoading || !detail) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading run details…</p>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {editingTitle && canEditTitle ? (
                <Input
                  value={titleDraft}
                  autoFocus
                  className="h-9 max-w-md border-slate-200 bg-white text-lg font-semibold text-slate-950 shadow-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveTitle();
                    }
                    if (e.key === 'Escape') {
                      setTitleDraft(detail.title);
                      setEditingTitle(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-left text-lg font-semibold text-slate-950 dark:text-slate-100 ${
                    canEditTitle ? 'cursor-pointer hover:underline' : 'cursor-default'
                  }`}
                  disabled={!canEditTitle || busy}
                  onClick={() => {
                    if (canEditTitle) setEditingTitle(true);
                  }}
                >
                  {detail.title}
                  {canEditTitle ? <Pencil className="size-3.5 shrink-0 opacity-60" /> : null}
                </button>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getPayrollStatusStyles(
                  detail.status,
                )}`}
              >
                <span
                  className={`size-1.5 rounded-full ${getPayrollStatusDotClass(detail.status)}`}
                />
                {payrollStatusLabel(detail.status)}
              </span>
              {detail.payoutMode === 'scheduled' && detail.paymentDate ? (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400">
                  Scheduled · {formatDate(detail.paymentDate)}
                </span>
              ) : null}
              {fundingPending ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
                  <RefreshCw className="size-3 animate-spin" />
                  Awaiting funding
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDate(detail.periodStart)} – {formatDate(detail.periodEnd)}
              {detail.paymentDate ? ` · Expected pay ${formatDate(detail.paymentDate)}` : ''} ·{' '}
              {detail.baseCurrency}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && isDraft ? (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1 size-4" />
                Edit run
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                disabled={busy}
                onClick={() => onReopen?.()}
              >
                <Pencil className="mr-1 size-4" />
                Edit
              </Button>
            ) : null}
            {canRetry ? (
              <Button
                size="sm"
                variant="brandSolid"
                disabled={busy}
                onClick={() => void handleRetryFailed()}
              >
                <RefreshCw className="mr-1 size-4" />
                {retryRunLabel}
              </Button>
            ) : null}
            {isAdmin && canDelete ? (
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => onDelete?.()}>
                <Trash2 className="mr-1 size-4" />
                Delete
              </Button>
            ) : null}
            {isAdmin && isDraft ? (
              <Button size="sm" variant="brandSolid" disabled={busy} onClick={handleCalculate}>
                Calculate
              </Button>
            ) : null}
            {isAdmin && detail.status === 'processing' ? (
              <Button
                size="sm"
                className="border-emerald-600 bg-emerald-600 text-white shadow-none hover:bg-emerald-700 hover:text-white dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={busy}
                onClick={async () => {
                  try {
                    await actions.approve.mutateAsync(runId);
                    toast.success('Payroll approved');
                    await refetch();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Approve failed');
                  }
                }}
              >
                Approve
              </Button>
            ) : null}
            {isAdmin && detail.status === 'approved' ? (
              <>
                {!hasPendingItems && hasInFlightItems ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
                    <RefreshCw className="size-3 animate-spin" />
                    Payment in progress
                  </span>
                ) : hasPendingItems ? (
                  payrollGatewayEnabled ? (
                    <Button
                      size="sm"
                      variant="brandSolid"
                      disabled={busy}
                      onClick={() => setPayNowConfirmOpen(true)}
                    >
                      {detail.payoutMode === 'scheduled' ? 'Pay now instead' : 'Pay employees'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          await actions.disburse.mutateAsync(runId);
                          toast.success('Marked as paid');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Disburse failed');
                        }
                      }}
                    >
                      Mark paid
                    </Button>
                  )
                ) : null}
                {payrollGatewayEnabled ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    disabled={busy}
                    onClick={() => setScheduleOpen(true)}
                  >
                    {detail.payoutMode === 'scheduled' ? 'Reschedule' : 'Schedule'}
                    {detail.paymentDate ? ` for ${formatDate(detail.paymentDate)}` : ''}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <Dialog open={payNowConfirmOpen} onOpenChange={setPayNowConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pay employees?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your company pays one checkout to fund this run (including Paqad&apos;s fee when
                applicable). We then send each employee&apos;s salary to their bank or wallet
                automatically.
              </p>
              <Button
                variant="brandSolid"
                className="w-full"
                disabled={busy}
                onClick={() => void handlePayNow()}
              >
                Pay now
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule payout</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <Button
                variant="brandSolid"
                className="w-full"
                disabled={busy}
                onClick={handleSchedule}
              >
                Confirm schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={retryFundingReviewOpen}
          onOpenChange={(open) => {
            setRetryFundingReviewOpen(open);
            if (!open) {
              setRetryFundingPreview(null);
              setRetryFundingApproved(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Review retry funding</DialogTitle>
            </DialogHeader>
            {retryFundingPreview ? (
              <div className="space-y-4">
                <Alert>
                  <AlertTitle>
                    {retryFundingPreview.amount > 0
                      ? 'Company-funded shortfall'
                      : 'Covered by your provider balance'}
                  </AlertTitle>
                  <AlertDescription>
                    {retryFundingAwaitingVerification
                      ? 'A checkout for this shortfall is already open. Finish it, then verify the funding — payouts start only after the provider confirms the payment.'
                      : retryFundingPreview.amount > 0
                        ? 'Only the uncovered part of the selected failed payouts is charged. Your provider balance is credited to this run first, and PaqadHR will not charge its platform fee again. Payouts start after checkout is verified and you retry the selected items.'
                        : 'Your provider balance already covers these failed payouts. Approving credits that balance to this run and retries without a checkout.'}
                  </AlertDescription>
                </Alert>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Amount to fund</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                    {formatMoney(retryFundingPreview.amount, retryFundingPreview.currency)}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    {retryFundingPreview.requiredAmount != null ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          Total funding required
                        </span>
                        <span>
                          {formatMoney(
                            retryFundingPreview.requiredAmount,
                            retryFundingPreview.currency,
                          )}
                        </span>
                      </div>
                    ) : null}
                    {retryFundingPreview.balanceApplied != null &&
                    retryFundingPreview.balanceApplied > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          Covered by provider balance
                        </span>
                        <span>
                          −{' '}
                          {formatMoney(
                            retryFundingPreview.balanceApplied,
                            retryFundingPreview.currency,
                          )}
                        </span>
                      </div>
                    ) : null}
                    {retryFundingPreview.availableBalance != null ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          Provider balance available
                        </span>
                        <span>
                          {formatMoney(
                            retryFundingPreview.availableBalance,
                            retryFundingPreview.currency,
                          )}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Selected payouts</span>
                      <span>{retryFundingItemIds.length}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">
                        PaqadHR platform fee
                      </span>
                      <span>{formatMoney(0, retryFundingPreview.currency)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Payout-fee reserve</span>
                      <span>
                        {formatMoney(
                          retryFundingPreview.payoutFeeReserve,
                          retryFundingPreview.currency,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {retryFundingItemIds.map((itemId) => {
                    const item = activeItems.find((candidate) => candidate.id === itemId);
                    return (
                      <div key={itemId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{item ? employeeName(item) : itemId}</span>
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">
                          {item?.paymentCurrency ?? detail?.baseCurrency ?? ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setRetryFundingReviewOpen(false)}
                  >
                    Cancel
                  </Button>
                  {retryFundingAwaitingVerification ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void verifyRetryFunding()}
                    >
                      {actions.reconcileRetryFunding.isPending
                        ? 'Verifying…'
                        : "I've paid — verify funding"}
                    </Button>
                  ) : null}
                  <Button
                    variant="brandSolid"
                    disabled={busy}
                    onClick={() => void confirmRetryFunding()}
                  >
                    {actions.approveRetryFunding.isPending ||
                    actions.createRetryFundingCheckout.isPending
                      ? 'Preparing checkout…'
                      : retryFundingApproved
                        ? 'Continue to checkout'
                        : retryFundingPreview.amount > 0
                          ? 'Approve amount and continue'
                          : 'Approve and retry now'}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {isLocked ? (
          <Alert>
            <Lock className="size-4" />
            <AlertTitle>Run locked</AlertTitle>
            <AlertDescription>
              {detail.status === 'failed'
                ? 'Payments failed for one or more employees. Fix payment methods or fund your provider, then use Retry payment. Editing is disabled after payout starts.'
                : 'Line items cannot be edited after approval. Bonuses and removals are disabled.'}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="dashboard-panel rounded-[8px] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Recipients</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {paymentCounts.total}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Expected: {formatMoney(paymentCounts.expectedAmount)}
            </p>
          </div>
          <div className="dashboard-panel rounded-[8px] p-4">
            <p className="text-xs text-green-700 dark:text-green-400">Paid</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {paymentCounts.paidCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatMoney(paymentCounts.paidAmount)}
            </p>
          </div>
          <div className="dashboard-panel rounded-[8px] p-4">
            <p className="text-xs text-red-700 dark:text-red-400">Failed</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {paymentCounts.failedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatMoney(paymentCounts.failedAmount)}
            </p>
          </div>
          <div className="dashboard-panel rounded-[8px] p-4">
            <p className="text-xs text-amber-700 dark:text-amber-400">Outstanding</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {paymentCounts.pendingCount + paymentCounts.processingCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatMoney(paymentCounts.pendingAmount)}
            </p>
          </div>
        </div>

        {isAdmin && isBachsFundingRun ? (
          <section className="dashboard-panel space-y-3 rounded-[8px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                  Run funding ledger
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {fundingLedgerQuery.data && fundingLedgerQuery.data.entries.length > 12 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAllFundingLedgerEntries((current) => !current)}
                  >
                    {showAllFundingLedgerEntries ? 'Show recent' : 'Show all entries'}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={fundingLedgerQuery.isFetching}
                  onClick={() => void fundingLedgerQuery.refetch()}
                >
                  <RefreshCw className="mr-1 size-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
            {fundingLedgerQuery.isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading ledger…</p>
            ) : fundingLedgerQuery.isError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Could not load the funding ledger. Refresh to try again.
              </p>
            ) : fundingLedgerQuery.data?.entries.length ? (
              <div className="space-y-2">
                {fundingLedgerQuery.data.entries
                  .slice()
                  .reverse()
                  .slice(
                    0,
                    showAllFundingLedgerEntries ? fundingLedgerQuery.data.entries.length : 12,
                  )
                  .map((entry) => {
                    const item = entry.payrollItemId
                      ? activeItems.find((candidate) => candidate.id === entry.payrollItemId)
                      : undefined;
                    const evidence = entry.evidence ?? {};
                    const checkoutAmount = Number(evidence.checkoutAmount);
                    const balanceApplied = Number(evidence.balanceApplied);
                    const showsBalanceSplit =
                      entry.eventType === 'funding_received' &&
                      Number.isFinite(checkoutAmount) &&
                      Number.isFinite(balanceApplied) &&
                      balanceApplied > 0;
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-1 border-t border-slate-100 pt-2 text-sm first:border-0 first:pt-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {entry.eventType.replaceAll('_', ' ').toLowerCase()}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {item
                              ? employeeName(item)
                              : entry.payrollItemId
                                ? 'Payout'
                                : 'Run-level funding'}
                            {' · '}
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          {showsBalanceSplit ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Checkout {formatMoney(checkoutAmount, entry.currency)} · provider
                              balance {formatMoney(balanceApplied, entry.currency)}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatMoney(Number(entry.amount), entry.currency)}
                        </span>
                      </div>
                    );
                  })}
                {fundingLedgerQuery.data.retryAuthorization === 'blocked' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Retry funding for this run must be approved from the selected failed payouts.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No verified funding ledger entries are recorded for this run yet.
              </p>
            )}
          </section>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {visibleItems.length} of {activeItems.length} recipients. Amounts in the summary
            use the run currency.
          </p>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AppTablePanel>
          <AppTable className="min-w-[1050px]">
            <AppTableHeaderSection>
              <AppTableHeaderRow>
                <AppTableHeadCell>Employee</AppTableHeadCell>
                <AppTableHeadCell>Base</AppTableHeadCell>
                <AppTableHeadCell>Bonuses</AppTableHeadCell>
                <AppTableHeadCell>Deductions</AppTableHeadCell>
                <AppTableHeadCell>Net</AppTableHeadCell>
                <AppTableHeadCell>Status</AppTableHeadCell>
                {isAdmin && (isDraft || canRetry) ? (
                  <AppTableHeadCell>Actions</AppTableHeadCell>
                ) : null}
              </AppTableHeaderRow>
            </AppTableHeaderSection>
            <AppTableBodySection>
              {visibleItems.map((item) => {
                const lines =
                  (item.metadata?.adjustmentLines as PayrollAdjustmentLine[] | undefined) ?? [];
                const name = employeeName(item);
                const employee = employees.find((emp) => emp.id === item.memberId);
                const currentSalary = currentSalaries.find(
                  (salary) => salary.memberId === item.memberId,
                );
                const baseSalary =
                  Number(item.baseSalary ?? 0) > 0
                    ? Number(item.baseSalary)
                    : Number(currentSalary?.payRate ?? 0);
                const baseSalaryCurrency =
                  item.baseSalaryCurrency || currentSalary?.currency || detail.baseCurrency;
                return (
                  <AppTableBodyRow key={item.id}>
                    <AppTableCell>
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          src={employee?.avatar}
                          name={name}
                          className="h-8 w-8 flex-shrink-0 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                          fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <span className="font-medium">{name}</span>
                      </div>
                    </AppTableCell>
                    <AppTableCell>
                      {baseSalary.toLocaleString()} {baseSalaryCurrency}
                    </AppTableCell>
                    <AppTableCell>
                      <div className="space-y-1">
                        <p>
                          {Number(item.adjustments ?? 0).toLocaleString()} {detail.baseCurrency}
                        </p>
                        {lines.length > 0 ? (
                          <ul className="space-y-0.5">
                            {lines.map((line) => (
                              <li
                                key={`${line.type}-${line.method}-${line.value}-${line.reason ?? ''}`}
                                className="text-xs text-slate-500 dark:text-slate-400"
                              >
                                {formatAdjustmentLineLabel(line, detail.baseCurrency)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </AppTableCell>
                    <AppTableCell>{Number(item.deductions ?? 0).toLocaleString()}</AppTableCell>
                    <AppTableCell>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {Number(item.netAmount ?? 0).toLocaleString()}{' '}
                          {item.baseSalaryCurrency || detail.baseCurrency}
                        </p>
                        {item.paymentCurrency &&
                        item.baseSalaryCurrency &&
                        item.paymentCurrency.toUpperCase() !==
                          item.baseSalaryCurrency.toUpperCase() ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Payout:{' '}
                            {item.metadata?.fxAtPayout === true
                              ? `quoted at disbursement → ${item.paymentCurrency}`
                              : `${Number(item.paymentAmount ?? 0).toLocaleString()} ${item.paymentCurrency}`}
                          </p>
                        ) : item.paymentCurrency ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Payout: {item.paymentCurrency}
                          </p>
                        ) : null}
                      </div>
                    </AppTableCell>
                    <AppTableCell>
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getPayrollStatusStyles(
                            item.status,
                          )}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${getPayrollStatusDotClass(item.status)}`}
                          />
                          {item.status}
                        </span>
                        {item.status === 'failed' && item.failureReason ? (
                          <p className="max-w-[220px] text-xs text-red-600 dark:text-red-400">
                            {item.failureReason}
                          </p>
                        ) : null}
                        {item.status === 'paid' && item.paidAt ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Paid {formatDate(item.paidAt)}
                          </p>
                        ) : null}
                      </div>
                    </AppTableCell>
                    {isAdmin && (isDraft || (canRetry && item.status === 'failed')) ? (
                      <AppTableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {isDraft ? (
                            <BonusDialog
                              item={item}
                              runId={runId}
                              currency={detail.baseCurrency}
                              onSaved={() => void refetch()}
                            />
                          ) : null}
                          {canRetry && item.status === 'failed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleRetryFailed([item.id])}
                            >
                              <RefreshCw className="mr-1 size-3.5" />
                              {retryItemLabel(item.id)}
                            </Button>
                          ) : null}
                        </div>
                      </AppTableCell>
                    ) : null}
                  </AppTableBodyRow>
                );
              })}
            </AppTableBodySection>
          </AppTable>
        </AppTablePanel>

        {detail.status === 'completed' && payslips.length > 0 ? (
          <div className="dashboard-panel space-y-3 rounded-[8px] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-medium text-slate-950 dark:text-slate-100">Payslips</h4>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {isAdmin ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Checkbox
                      id="send-email-on-publish"
                      checked={sendEmail}
                      onCheckedChange={(v) => setSendEmail(v === true)}
                    />
                    <Label htmlFor="send-email-on-publish" className="font-normal">
                      Send email on publish
                      {tenantSettings?.settings?.general?.emailPayslipOnPublish ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {' '}
                          (workspace default: on)
                        </span>
                      ) : null}
                    </Label>
                  </div>
                ) : null}
                <Button
                  size="sm"
                  variant="brandSolid"
                  disabled={
                    busy || payslips.every((p) => p.published || !canManagePayrollItem(p.memberId))
                  }
                  onClick={handlePublishAll}
                >
                  Publish all
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[8px] border border-[#d7e3f6] dark:border-slate-800">
              {payslips
                .filter((payslip) => canManagePayrollItem(payslip.memberId))
                .map((payslip) => {
                  const employee = employees.find((emp) => emp.id === payslip.memberId);
                  const name = payslip.employeeName;
                  return (
                    <div
                      key={payslip.itemId}
                      className="flex flex-col gap-3 border-b border-[#d7e3f6] bg-white/65 p-4 last:border-b-0 dark:border-slate-800 dark:bg-slate-950/45 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          src={employee?.avatar}
                          name={name}
                          className="h-8 w-8 flex-shrink-0 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                          fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-950 dark:text-slate-100">
                            {name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {payslip.paidAt ? `Paid ${formatDate(payslip.paidAt)}` : 'Paid'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getPayrollStatusStyles(
                            payslip.published ? 'published' : 'unpublished',
                          )}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${getPayrollStatusDotClass(
                              payslip.published ? 'published' : 'unpublished',
                            )}`}
                          />
                          {payslip.published ? 'Published' : 'Unpublished'}
                        </span>
                        {payslip.published ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            PDF emailed to employee
                          </p>
                        ) : null}
                        {!payslip.published ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await actions.publishPayslips.mutateAsync({
                                  runId,
                                  itemIds: [payslip.itemId],
                                  sendEmail,
                                });
                                toast.success('Payslip published');
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Publish failed');
                              }
                            }}
                          >
                            Publish
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}
      </div>
      <EditPayrollRunDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        run={detail}
        activeEmployees={activeEmployees}
        currentSalaries={currentSalaries}
        paymentReadyMemberIds={paymentReadyMemberIds}
        onSaved={() => {
          void refetch();
        }}
      />
    </>
  );
}
