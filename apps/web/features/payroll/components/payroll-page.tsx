'use client';

import { AlertTriangle, CalendarDays, Download, FileText, Plus, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
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
  onAction: (action: string, id: string) => void;
  busy: boolean;
  payrollGatewayEnabled: boolean;
  isAdmin: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
        selected ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20'
      }`}
    >
      <button type="button" className="space-y-1 text-left" onClick={() => onSelect(run.id)}>
        <div className="flex items-center gap-2">
          <p className="font-medium">{run.title}</p>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
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
            disabled={busy}
            onClick={() => onAction('approve', run.id)}
          >
            Approve
          </Button>
        ) : null}
        {isAdmin && run.status === 'approved' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => onAction('disburse', run.id)}>
              Mark paid
            </Button>
            {payrollGatewayEnabled ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onAction('process', run.id)}
              >
                Pay via Nomba
              </Button>
            ) : null}
          </>
        ) : null}
        {isAdmin && ['processing', 'approved', 'completed'].includes(run.status) ? (
          <Button
            size="sm"
            variant="outline"
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

  useEffect(() => {
    const preferred = (
      tenant as { preferredCurrency?: string } | null
    )?.preferredCurrency?.toUpperCase();
    if (preferred && fiatCurrencies.includes(preferred)) {
      setBaseCurrency(preferred);
      return;
    }
    if (fiatCurrencies[0]) {
      setBaseCurrency(fiatCurrencies[0]);
    }
  }, [tenant?.preferredCurrency, fiatCurrencies]);

  const busy =
    createRun.isPending ||
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.process.isPending ||
    actions.exportCsv.isPending ||
    actions.removeItem.isPending ||
    actions.notifyPaymentSetup.isPending;

  const activeEmployees = employees.filter((e) => e.status === 'Active');

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Enter a payroll title');
      return;
    }
    if (!periodStart || !periodEnd || !paymentDate) {
      toast.error('Set period and payment dates');
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
      toast.success('Payroll run created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create run');
    }
  };

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === 'calculate') {
        const result = await actions.calculate.mutateAsync({ id });
        setSelectedRunId(id);
        if (result.warnings?.length) {
          toast.warning(
            `${result.warnings.length} employee(s) are missing payment settings and will miss payout.`,
          );
        } else {
          toast.success('Payroll calculated');
        }
        return;
      }
      if (action === 'approve') await actions.approve.mutateAsync(id);
      if (action === 'disburse') await actions.disburse.mutateAsync(id);
      if (action === 'process') await actions.process.mutateAsync(id);
      if (action === 'export') await actions.exportCsv.mutateAsync(id);
      toast.success(`Payroll ${action} completed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
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
  const payrollGatewayEnabled = billingOverview?.paymentsEnabled ?? false;
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;
  const isAdmin = isTenantAdmin(role);
  const canManagePayroll = canViewTeamPayroll(viewerMemberId, employees, role);

  return (
    <AppPage>
      {isAdmin && activeTab === 'runs' ? (
        <PageActions>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 rounded-lg text-xs">
                <Plus className="mr-1.5 size-3.5" />
                New run
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create payroll run</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="March 2026 payroll"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Period start</Label>
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period end</Label>
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fiatCurrencies.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={createRun.isPending} onClick={handleCreate}>
                  Create run
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PageActions>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          {isAdmin && <TabsTrigger value="salaries">Salaries</TabsTrigger>}
        </TabsList>

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
                ? 'Calculate, review payment readiness, approve, and disburse salaries'
                : 'Review and publish payslips for your direct reports'
            }
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
            <ContentCard title="Run detail" description="Review lines, bonuses, and payslips">
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
              bodyClassName="space-y-3"
            >
              {readiness.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.employeeName}</p>
                      <Badge variant={item.ready ? 'default' : 'destructive'}>
                        {item.ready ? 'Ready' : 'Will miss payment'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <p className="text-sm text-muted-foreground">
                      Net {item.netAmount.toLocaleString()} {readiness.currency}
                    </p>
                  </div>
                  {!item.ready && item.status !== 'cancelled' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
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
    </AppPage>
  );
}
