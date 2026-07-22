'use client';

import { AlertTriangle, CalendarDays, Download, FileText, Plus, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamCompensation } from '@/features/employees/components/team-compensation';
import { PayrollRunDetail } from '@/features/payroll/components/payroll-run-detail';
import { PaymentAdminSection } from '@/features/settings/components/payment-admin-section';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useSupportedPaymentCurrencies } from '@/hooks/queries/use-payment-methods';
import {
  useCreatePayrollRun,
  usePayrollActions,
  usePayrollReadiness,
  usePayrollRuns,
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
      <button type="button" className="space-y-1 text-left" onClick={() => onSelect(run.id)}>
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
  const [title, setTitle] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const defaultPayDate = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    .toISOString()
    .slice(0, 10);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [paymentDate, setPaymentDate] = useState(defaultPayDate);
  const [baseCurrency, setBaseCurrency] = useState('NGN');

  const { data: employees = [] } = useEmployees();
  const { tenant } = useTenant();
  const { data: billingOverview } = useBillingOverview();
  const { data: currencyOptions } = useSupportedPaymentCurrencies();
  const { data, isLoading, isError, error } = usePayrollRuns();
  const { data: readiness } = usePayrollReadiness(selectedRunId ?? undefined);
  const createRun = useCreatePayrollRun();
  const actions = usePayrollActions();

  const fiatCurrencies = currencyOptions?.fiat ?? ['NGN'];
  const cryptoCurrencies = currencyOptions?.crypto ?? [];
  const runCurrencies = [...fiatCurrencies, ...cryptoCurrencies];

  useEffect(() => {
    const preferred = tenant?.preferredCurrency?.toUpperCase();
    if (preferred && runCurrencies.includes(preferred)) {
      setBaseCurrency(preferred);
      return;
    }
    if (runCurrencies[0]) {
      setBaseCurrency(runCurrencies[0]);
    }
  }, [tenant?.preferredCurrency, runCurrencies.join(',')]);

  const busy =
    createRun.isPending ||
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.process.isPending ||
    actions.payNow.isPending ||
    actions.schedule.isPending ||
    actions.exportCsv.isPending ||
    actions.removeItem.isPending ||
    actions.notifyPaymentSetup.isPending;

  const activeEmployees = employees.filter((e) => e.status === 'Active');
  const [scheduleRunId, setScheduleRunId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(defaultPayDate);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Enter a payroll title');
      return;
    }
    if (!periodStart || !periodEnd || !paymentDate) {
      toast.error('Set period and expected pay dates');
      return;
    }
    if (new Date(periodEnd) <= new Date(periodStart)) {
      toast.error('Period end must be after period start');
      return;
    }
    const activeIds = activeEmployees.map((e) => e.id);
    if (!activeIds.length) {
      toast.error('No active employees to include');
      return;
    }
    try {
      const run = await createRun.mutateAsync({
        title: title.trim(),
        frequency: 'monthly',
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        paymentDate: new Date(paymentDate).toISOString(),
        baseCurrency,
        employeeIds: activeIds,
      });
      setOpen(false);
      setTitle('');
      setSelectedRunId(run.id);
      if (run.alreadyExists) {
        toast.message('Run already exists for this period');
      } else {
        toast.success('Payroll run created');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create run');
    }
  };

  const handleAction = async (action: string, id: string, paymentDateOverride?: string) => {
    try {
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
          paymentDateOverride ||
            existing?.paymentDate?.toString().slice(0, 10) ||
            defaultPayDate,
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
      <AppPage className="mx-auto w-full max-w-7xl">
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage className="mx-auto w-full max-w-7xl">
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
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;
  const isAdmin = isTenantAdmin(role);
  const canManagePayroll = canViewTeamPayroll(viewerMemberId, employees, role);

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
              <TabsTrigger
                value="runs"
                className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
              >
                Runs
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="salaries"
                  className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
                >
                  Salaries
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {isAdmin && activeTab === 'runs' ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="brandSolid" size="app" className="w-full sm:w-max">
                  <Plus className="size-4" />
                  New run
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create payroll run</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Creating a run does not take money. You calculate, approve, then Pay now or
                    Schedule. One currency per run — create another run for a different currency.
                    Bonuses and deductions are added before Calculate.
                  </p>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="March 2026 payroll"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Period start</Label>
                      <Input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period end</Label>
                      <Input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected pay date</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Usually on or after period end. Any calendar day is allowed.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                      <SelectTrigger className="w-full border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {runCurrencies.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                            {cryptoCurrencies.includes(code) ? ' (crypto)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Payout currency for this run. Only employees paid in this currency are
                      included. Split different currencies into separate runs.
                    </p>
                  </div>
                  <Button
                    variant="brandSolid"
                    className="w-full"
                    disabled={createRun.isPending}
                    onClick={handleCreate}
                  >
                    Create run
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        <TabsContent value="runs" className="space-y-6 mt-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active employees"
              value={activeEmployees.length}
              hint="Eligible for payroll"
              icon={Wallet}
            />
            <StatCard
              label="Total runs"
              value={runs.length}
              hint="All payroll cycles"
              icon={FileText}
            />
            <StatCard
              label="Completed"
              value={completedRuns}
              hint="Paid out runs"
              icon={CalendarDays}
            />
            <StatCard
              label="In progress"
              value={pendingRuns}
              hint="Draft or awaiting action"
              icon={Wallet}
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
            description={
              isAdmin
                ? 'Calculate, approve, then Pay now or Schedule. Mark paid stays available for offline payouts.'
                : 'Review and publish payslips for your direct reports'
            }
            className="dashboard-panel rounded-[8px]"
            bodyClassName="space-y-3"
          >
            {runs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={canManagePayroll ? 'No payroll runs' : 'Payroll not available'}
                description={
                  canManagePayroll
                    ? ''
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
            <ContentCard
              title="Run detail"
              description="Review lines, bonuses, and payslips"
              className="dashboard-panel rounded-[8px]"
            >
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
              description={`${readiness.readyCount} ready · ${readiness.notReadyCount} need attention`}
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
            <ContentCard
              title="Verify payment details"
              description="Approve employee bank accounts before payroll can pay them"
              className="dashboard-panel rounded-[8px]"
            >
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gateway payout starts automatically on or after this date while the run stays
              approved.
            </p>
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
    </AppPage>
  );
}
