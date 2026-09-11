'use client';

import {
  AlertTriangle,
  CalendarDays,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { DestructiveConfirmDialog } from '@/components/destructive-confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamCompensation } from '@/features/employees/components/team-compensation';
import { CreatePayrollRunDialog } from '@/features/payroll/components/create-payroll-run-dialog';
import { PayrollRunDetail } from '@/features/payroll/components/payroll-run-detail';
import { toastPayrollPayoutResult } from '@/features/payroll/toast-payroll-payout';
import { PaymentAdminSection } from '@/features/settings/components/payment-admin-section';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useCurrentSalaries } from '@/hooks/queries/use-employment';
import {
  usePayrollActions,
  usePayrollReadiness,
  usePayrollRuns,
  usePayrollSetupSummary,
} from '@/hooks/queries/use-payroll';
import { canViewTeamPayroll, isTenantAdmin } from '@/lib/auth/manager-access';
import { formatDate } from '@/lib/format-date';
import type { PayrollRun } from '@/lib/schemas/payroll';
import { useTenant } from '@/providers/tenant-provider';

function statusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'default';
    case 'approved':
      return 'secondary';
    case 'processing':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function payrollStatusLabel(status: string) {
  switch (status) {
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

function canDeletePayrollRun(run: Pick<PayrollRun, 'status'>) {
  return run.status !== 'completed';
}

const APPROVE_BUTTON_CLASS =
  'border-emerald-600 bg-emerald-600 text-white shadow-none hover:bg-emerald-700 hover:text-white dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500';

const PAID_BADGE_CLASS =
  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';

function PayrollRunRow({
  run,
  selected,
  onSelect,
  onAction,
  busy,
  payrollGatewayEnabled,
  isAdmin,
}: {
  run: PayrollRun;
  selected: boolean;
  onSelect: (id: string) => void;
  onAction: (action: string, id: string, paymentDate?: string) => void;
  busy: boolean;
  payrollGatewayEnabled: boolean;
  isAdmin: boolean;
}) {
  const scheduledLabel =
    run.payoutMode === 'scheduled' && run.paymentDate
      ? `Scheduled · ${formatDate(run.paymentDate)}`
      : null;

  const canDelete = isAdmin && canDeletePayrollRun(run);

  let primary: {
    label: string;
    action: string;
    className?: string;
    variant?: 'brandSolid';
  } | null = null;
  if (isAdmin && run.status === 'draft') {
    primary = { label: 'Calculate', action: 'calculate' };
  } else if (isAdmin && run.status === 'processing') {
    primary = { label: 'Approve', action: 'approve', className: APPROVE_BUTTON_CLASS };
  } else if (isAdmin && run.status === 'approved') {
    primary = payrollGatewayEnabled
      ? { label: 'Pay employees', action: 'fund-and-pay', variant: 'brandSolid' }
      : { label: 'Mark paid', action: 'disburse' };
  } else if (isAdmin && run.status === 'failed' && payrollGatewayEnabled) {
    primary = { label: 'Retry payment', action: 'retry', variant: 'brandSolid' };
  }

  const secondaryItems: Array<{
    label: string;
    action: string;
    paymentDate?: string;
    destructive?: boolean;
  }> = [];

  if (isAdmin && run.status === 'processing') {
    secondaryItems.push({ label: 'Edit', action: 'reopen' });
  }
  if (isAdmin && run.status === 'approved' && payrollGatewayEnabled) {
    secondaryItems.push({
      label: 'Schedule',
      action: 'schedule',
      paymentDate: run.paymentDate ? String(run.paymentDate).slice(0, 10) : undefined,
    });
  }
  if (canDelete) {
    secondaryItems.push({ label: 'Delete', action: 'delete', destructive: true });
  }

  return (
    <div
      className={`dashboard-soft-tile flex flex-col gap-4 rounded-[8px] border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        selected
          ? 'border-[#c7d7f1] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/85'
          : 'border-[#d7e3f6] bg-white/70 dark:border-slate-800 dark:bg-slate-950/45'
      }`}
    >
      <button
        type="button"
        className="cursor-pointer space-y-1 text-left"
        onClick={() => onSelect(run.id)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-950 dark:text-slate-100">{run.title}</p>
          {run.status === 'completed' ? (
            <Badge className={PAID_BADGE_CLASS}>{payrollStatusLabel(run.status)}</Badge>
          ) : (
            <Badge variant={statusVariant(run.status)}>{payrollStatusLabel(run.status)}</Badge>
          )}
          {scheduledLabel ? <Badge variant="outline">{scheduledLabel}</Badge> : null}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} · {run.baseCurrency}
          {run.totalNetAmount != null
            ? ` · Net ${Number(run.totalNetAmount).toLocaleString()}`
            : ''}
        </p>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        {primary ? (
          <Button
            size="sm"
            variant={primary.variant ?? (primary.className ? undefined : 'outline')}
            className={
              primary.className ??
              (primary.variant
                ? undefined
                : 'border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100')
            }
            disabled={busy}
            onClick={() => onAction(primary.action, run.id)}
          >
            {primary.action === 'retry' ? <RefreshCw className="mr-1 size-4" /> : null}
            {primary.label}
          </Button>
        ) : null}
        {secondaryItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white px-2 text-slate-700 shadow-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                disabled={busy}
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {secondaryItems.map((item) => (
                <DropdownMenuItem
                  key={item.action}
                  variant={item.destructive ? 'destructive' : 'default'}
                  onClick={() => onAction(item.action, run.id, item.paymentDate)}
                >
                  {item.destructive ? <Trash2 className="size-4" /> : null}
                  {item.action === 'reopen' ? <Pencil className="size-4" /> : null}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function PayrollPage() {
  const [activeTab, setActiveTab] = useState('runs');
  const [open, setOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const now = new Date();
  const defaultPayDate = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    .toISOString()
    .slice(0, 10);

  const { data: employees = [] } = useEmployees();
  const { tenant } = useTenant();
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;
  const isAdmin = isTenantAdmin(role);
  const { data: currentSalaries = [] } = useCurrentSalaries(isAdmin);
  const { data: billingOverview } = useBillingOverview();
  const { data, isLoading, isError, error } = usePayrollRuns();
  const { data: readiness } = usePayrollReadiness(selectedRunId ?? undefined);
  const { data: setupSummary } = usePayrollSetupSummary(isAdmin);
  const actions = usePayrollActions();

  const busy =
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.process.isPending ||
    actions.payNow.isPending ||
    actions.fundAndPay.isPending ||
    actions.retryFailed.isPending ||
    actions.schedule.isPending ||
    actions.removeItem.isPending ||
    actions.deleteRun.isPending ||
    actions.reopen.isPending ||
    actions.updateTitle.isPending ||
    actions.notifyPaymentSetup.isPending;

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active'),
    [employees],
  );
  const [scheduleRunId, setScheduleRunId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(defaultPayDate);
  const [reopenRunId, setReopenRunId] = useState<string | null>(null);
  const [payNowRunId, setPayNowRunId] = useState<string | null>(null);

  const handleAction = async (action: string, id: string, paymentDateOverride?: string) => {
    try {
      if (action === 'delete') {
        setDeleteRunId(id);
        return;
      }
      if (action === 'reopen') {
        setReopenRunId(id);
        return;
      }
      if (action === 'calculate') {
        const result = await actions.calculate.mutateAsync({ id });
        setSelectedRunId(id);
        if (result.warnings?.length) {
          toast.warning(
            `${result.warnings.length} employee(s) need attention (payment settings or currency).`,
          );
        } else {
          toast.success('Payroll calculated');
        }
        return;
      }
      if (action === 'approve') {
        await actions.approve.mutateAsync(id);
        toast.success('Payroll approved');
        return;
      }
      if (action === 'disburse') {
        await actions.disburse.mutateAsync(id);
        toast.success('Marked as paid');
        return;
      }
      if (action === 'process' || action === 'pay-now' || action === 'fund-and-pay') {
        setPayNowRunId(id);
        return;
      }
      if (action === 'retry') {
        const response = await actions.retryFailed.mutateAsync(id);
        toastPayrollPayoutResult(response.result, 'retry');
        return;
      }
      if (action === 'schedule') {
        const existing = data?.runs?.find((r) => r.id === id);
        setScheduleRunId(id);
        setScheduleDate(
          paymentDateOverride || existing?.paymentDate?.toString().slice(0, 10) || defaultPayDate,
        );
        return;
      }
      toast.success(`Payroll ${action} completed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const confirmSchedule = async () => {
    if (!scheduleRunId || !scheduleDate) {
      toast.error('Pick a payment date');
      return;
    }
    try {
      await actions.schedule.mutateAsync({
        id: scheduleRunId,
        paymentDate: new Date(scheduleDate).toISOString(),
      });
      setScheduleRunId(null);
      toast.success(`Scheduled for ${formatDate(scheduleDate)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Schedule failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleteRunId) return;
    try {
      await actions.deleteRun.mutateAsync(deleteRunId);
      if (selectedRunId === deleteRunId) {
        setSelectedRunId(null);
      }
      setDeleteRunId(null);
      toast.success('Payroll run deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payroll run');
    }
  };

  const confirmReopen = async () => {
    if (!reopenRunId) return;
    try {
      await actions.reopen.mutateAsync(reopenRunId);
      setSelectedRunId(reopenRunId);
      setReopenRunId(null);
      toast.success('Run opened for editing — update bonuses, then Calculate again');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open payroll run for editing');
    }
  };

  const confirmPayNow = async () => {
    if (!payNowRunId) return;
    const checkoutTab = window.open('about:blank', '_blank');
    try {
      const response = await actions.fundAndPay.mutateAsync(payNowRunId);
      if (response.action === 'checkout') {
        if (response.checkoutUrl) {
          toast.message('Complete checkout to fund, then we pay automatically');
          if (checkoutTab) {
            checkoutTab.opener = null;
            checkoutTab.location.href = response.checkoutUrl;
          } else {
            window.location.assign(response.checkoutUrl);
          }
        } else {
          checkoutTab?.close();
          toast.error(
            response.preflight?.message ??
              `Fund the payout provider${response.preflight?.dashboardUrl ? ` (${response.preflight.dashboardUrl})` : ''} then retry.`,
          );
        }
        setPayNowRunId(null);
        return;
      }
      checkoutTab?.close();
      toastPayrollPayoutResult(response.result, 'pay');
      setPayNowRunId(null);
    } catch (err) {
      checkoutTab?.close();
      toast.error(err instanceof Error ? err.message : 'Payout failed');
    }
  };

  const handleRemove = async (runId: string, itemId: string) => {
    try {
      await actions.removeItem.mutateAsync({ runId, itemId });
      toast.success('Employee removed from payroll run');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove employee');
    }
  };

  const handleNotify = async (runId: string, itemId: string) => {
    try {
      await actions.notifyPaymentSetup.mutateAsync({ runId, itemId });
      toast.success('Employee notified to complete payment settings');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to notify employee');
    }
  };

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load payroll</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  const runs = data?.runs ?? [];
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const pendingRuns = runs.filter((r) =>
    ['draft', 'processing', 'approved'].includes(r.status),
  ).length;
  const notReadyItems =
    readiness?.items.filter((item) => !item.ready && item.status !== 'cancelled') ?? [];
  const payrollGatewayEnabled = billingOverview?.payrollGatewayEnabled ?? false;
  const canManagePayroll = canViewTeamPayroll(viewerMemberId, employees, role);

  return (
    <AppPage className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto pb-1">
            <TabsList className="app-segmented-control">
              <TabsTrigger value="runs" className="app-segmented-trigger sm:px-6">
                Runs
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="salaries" className="app-segmented-trigger sm:px-6">
                  Salaries
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {isAdmin && activeTab === 'runs' ? (
            <>
              <Button
                variant="brandSolid"
                size="app"
                className="w-full sm:w-max"
                onClick={() => setOpen(true)}
              >
                <Plus className="size-4" />
                New run
              </Button>
              <CreatePayrollRunDialog
                open={open}
                onOpenChange={setOpen}
                activeEmployees={activeEmployees}
                currentSalaries={currentSalaries}
                fallbackCurrency={tenant?.preferredCurrency?.toUpperCase() ?? 'USD'}
                paymentReadyMemberIds={
                  new Set((setupSummary?.readyMemberIds ?? []).map((id) => id))
                }
                onCreated={(runId) => {
                  if (runId) setSelectedRunId(runId);
                }}
              />
            </>
          ) : null}
        </div>

        <TabsContent value="runs" className="space-y-6 mt-0">
          {isAdmin && setupSummary && setupSummary.totalEmployees > 0 ? (
            <div className="dashboard-soft-tile flex flex-col gap-3 rounded-[8px] border border-[#d7e3f6] p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-950 dark:text-slate-100">
                  Company payment setup
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {setupSummary.paymentReadyCount}/{setupSummary.totalEmployees} salary-eligible
                  employees have a verified primary payout method
                </p>
              </div>
              {setupSummary.byCurrency.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Salary by currency
                  </span>
                  {setupSummary.byCurrency.map((row) => (
                    <Badge key={row.currency} variant="outline">
                      {row.currency} · {row.paymentReadyCount}/{row.employeeCount} ready
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {!selectedRunId ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Active employees"
                value={activeEmployees.length}
                icon={Wallet}
                iconClassName="bg-violet-500/12 text-violet-700 dark:bg-violet-500/18 dark:text-violet-200"
              />
              <StatCard
                label="Total runs"
                value={runs.length}
                icon={FileText}
                iconClassName="bg-blue-500/12 text-blue-700 dark:bg-blue-500/18 dark:text-blue-200"
              />
              <StatCard
                label="Completed"
                value={completedRuns}
                icon={CalendarDays}
                iconClassName="bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-200"
              />
              <StatCard
                label="In progress"
                value={pendingRuns}
                icon={Wallet}
                iconClassName="bg-amber-500/14 text-amber-700 dark:bg-amber-500/18 dark:text-amber-200"
              />
            </div>
          ) : null}

          {selectedRunId && notReadyItems.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>People on this run need payment details</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {notReadyItems.length} employee
                  {notReadyItems.length === 1 ? '' : 's'} on this run{' '}
                  {notReadyItems.length === 1 ? 'is' : 'are'} missing payment details. Notify them
                  or remove them before approving.
                </p>
                <ul className="space-y-2">
                  {notReadyItems.map((item) => (
                    <li
                      key={item.itemId}
                      className="flex flex-col gap-2 rounded-[6px] border border-red-200/80 bg-white/50 p-3 dark:border-red-900/50 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-slate-950 dark:text-slate-100">
                          {item.employeeName}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.message}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-slate-200 bg-white text-slate-700 shadow-none dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                          disabled={busy}
                          onClick={() => handleNotify(selectedRunId, item.itemId)}
                        >
                          Notify
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          disabled={busy}
                          onClick={() => handleRemove(selectedRunId, item.itemId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <ContentCard
            title="Payroll runs"
            className="dashboard-panel rounded-[8px]"
            bodyClassName="space-y-3"
          >
            {runs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={canManagePayroll ? 'No payroll runs' : 'Payroll not available'}
                description={
                  canManagePayroll
                    ? undefined
                    : 'Only admins and managers with direct reports can access payroll runs.'
                }
                className="min-h-[260px] bg-white dark:bg-slate-950/60"
              />
            ) : (
              runs.map((run) => (
                <PayrollRunRow
                  key={run.id}
                  run={run}
                  selected={selectedRunId === run.id}
                  onSelect={setSelectedRunId}
                  busy={busy}
                  payrollGatewayEnabled={payrollGatewayEnabled}
                  isAdmin={isAdmin}
                  onAction={handleAction}
                />
              ))
            )}
          </ContentCard>

          {selectedRunId ? (
            <ContentCard title="Run detail" className="dashboard-panel rounded-[8px]">
              <PayrollRunDetail
                runId={selectedRunId}
                payrollGatewayEnabled={payrollGatewayEnabled}
                isAdmin={isAdmin}
                onDelete={() => setDeleteRunId(selectedRunId)}
                onReopen={() => setReopenRunId(selectedRunId)}
              />
            </ContentCard>
          ) : null}

          {isAdmin ? (
            <ContentCard title="Verify payment details" className="dashboard-panel rounded-[8px]">
              <PaymentAdminSection />
            </ContentCard>
          ) : null}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="salaries" className="space-y-6 mt-0">
            <TeamCompensation hideAppPage />
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={Boolean(payNowRunId)}
        onOpenChange={(next) => {
          if (!next) setPayNowRunId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay employees?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Opens checkout to fund this payroll, then pays employees automatically.
            </p>
            <Button
              variant="brandSolid"
              className="w-full"
              disabled={actions.fundAndPay.isPending}
              onClick={() => void confirmPayNow()}
            >
              Pay now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(scheduleRunId)}
        onOpenChange={(next) => {
          if (!next) setScheduleRunId(null);
        }}
      >
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
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </div>
            <Button
              variant="brandSolid"
              className="w-full"
              disabled={actions.schedule.isPending}
              onClick={() => void confirmSchedule()}
            >
              Schedule for {scheduleDate ? formatDate(scheduleDate) : '…'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={Boolean(deleteRunId)}
        onOpenChange={(next) => {
          if (!next) setDeleteRunId(null);
        }}
        title="Delete payroll run?"
        description="Removes the run and its employees. Paid runs can't be deleted."
        actionLabel="Delete run"
        isPending={actions.deleteRun.isPending}
        preventAutoClose
        onConfirm={() => void confirmDelete()}
      />

      <DestructiveConfirmDialog
        open={Boolean(reopenRunId)}
        onOpenChange={(next) => {
          if (!next) setReopenRunId(null);
        }}
        title="Edit payroll run?"
        description="Returns run to draft so you can edit. Recalculate before approve."
        actionLabel="Edit"
        isPending={actions.reopen.isPending}
        preventAutoClose
        onConfirm={() => void confirmReopen()}
      />
    </AppPage>
  );
}
