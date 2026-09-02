'use client';

import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  Plus,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamCompensation } from '@/features/employees/components/team-compensation';
import { CreatePayrollRunDialog } from '@/features/payroll/components/create-payroll-run-dialog';
import { PayrollRunDetail } from '@/features/payroll/components/payroll-run-detail';
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

function canDeletePayrollRun(run: PayrollRun) {
  return run.status === 'draft';
}

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
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          {scheduledLabel ? <Badge variant="outline">{scheduledLabel}</Badge> : null}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} · {run.baseCurrency}
          {run.totalNetAmount != null
            ? ` · Net ${Number(run.totalNetAmount).toLocaleString()}`
            : ''}
        </p>
      </button>
      <div className="flex flex-wrap gap-2">
        {isAdmin && canDeletePayrollRun(run) ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => onAction('delete', run.id)}
          >
            <Trash2 className="mr-1 size-4" />
            Delete
          </Button>
        ) : null}
        {isAdmin && run.status === 'draft' ? (
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            disabled={busy}
            onClick={() => onAction('calculate', run.id)}
          >
            Calculate
          </Button>
        ) : null}
        {isAdmin && run.status === 'processing' ? (
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            disabled={busy}
            onClick={() => onAction('approve', run.id)}
          >
            Approve
          </Button>
        ) : null}
        {isAdmin && run.status === 'approved' ? (
          <>
            {payrollGatewayEnabled ? (
              <Button
                size="sm"
                variant="brandSolid"
                disabled={busy}
                onClick={() => onAction('pay-now', run.id)}
              >
                Pay now
              </Button>
            ) : null}
            {payrollGatewayEnabled ? (
              <Button
                size="sm"
                variant="secondary"
                className="bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                disabled={busy}
                onClick={() =>
                  onAction(
                    'schedule',
                    run.id,
                    run.paymentDate ? String(run.paymentDate).slice(0, 10) : undefined,
                  )
                }
              >
                Schedule
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              disabled={busy}
              onClick={() => onAction('disburse', run.id)}
            >
              Mark paid
            </Button>
          </>
        ) : null}
        {isAdmin && ['processing', 'approved', 'completed'].includes(run.status) ? (
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            disabled={busy}
            onClick={() => onAction('export', run.id)}
          >
            <Download className="mr-1 size-4" />
            CSV
          </Button>
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
    actions.schedule.isPending ||
    actions.exportCsv.isPending ||
    actions.removeItem.isPending ||
    actions.deleteRun.isPending ||
    actions.notifyPaymentSetup.isPending;

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active'),
    [employees],
  );
  const [scheduleRunId, setScheduleRunId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(defaultPayDate);

  const handleAction = async (action: string, id: string, paymentDateOverride?: string) => {
    try {
      if (action === 'delete') {
        setDeleteRunId(id);
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
      if (action === 'approve') await actions.approve.mutateAsync(id);
      if (action === 'disburse') await actions.disburse.mutateAsync(id);
      if (action === 'process' || action === 'pay-now') {
        await actions.payNow.mutateAsync(id);
        toast.success('Payout started');
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
      if (action === 'export') await actions.exportCsv.mutateAsync(id);
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
  const notReadyItems = readiness?.items.filter((item) => !item.ready) ?? [];
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
                  Payment setup
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {setupSummary.paymentReadyCount}/{setupSummary.totalEmployees} employees have
                  payment details set
                </p>
              </div>
              {setupSummary.byCurrency.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Pay by currency
                  </span>
                  {setupSummary.byCurrency.map((row) => (
                    <Badge key={row.currency} variant="outline">
                      {row.currency} · {row.employeeCount}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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

          {selectedRunId && notReadyItems.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Payment settings incomplete</AlertTitle>
              <AlertDescription>
                {notReadyItems.length} employee(s) will miss this payroll unless you remove them or
                ask them to complete payment settings.
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
              />
            </ContentCard>
          ) : null}

          {isAdmin && selectedRunId && readiness ? (
            <ContentCard
              title="Employee payment readiness"
              description={`${readiness.readyCount}/${readiness.totalEmployees} employees have payment details set`}
              className="dashboard-panel rounded-[8px]"
              bodyClassName="space-y-3"
            >
              {readiness.items.map((item) => (
                <div
                  key={item.itemId}
                  className="dashboard-soft-tile flex flex-col gap-3 rounded-[8px] border border-[#d7e3f6] p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-950 dark:text-slate-100">
                        {item.employeeName}
                      </p>
                      <Badge variant={item.ready ? 'default' : 'destructive'}>
                        {item.ready ? 'Ready' : 'Will miss payment'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.message}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Net {item.netAmount.toLocaleString()} {readiness.currency}
                    </p>
                  </div>
                  {!item.ready && item.status !== 'cancelled' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        disabled={busy}
                        onClick={() => handleNotify(selectedRunId, item.itemId)}
                      >
                        Notify employee
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleRemove(selectedRunId, item.itemId)}
                      >
                        Remove from run
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
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
        description="This removes the draft run and all employees on it. Completed or paid runs cannot be deleted."
        actionLabel="Delete run"
        isPending={actions.deleteRun.isPending}
        preventAutoClose
        onConfirm={() => void confirmDelete()}
      />
    </AppPage>
  );
}
