'use client';

import { AlertTriangle, CalendarDays, Download, FileText, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
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
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { useEmployees } from '@/hooks/queries/use-employees';
import {
  useCreatePayrollRun,
  usePayrollActions,
  usePayrollReadiness,
  usePayrollRuns,
} from '@/hooks/queries/use-payroll';
import { formatDate } from '@/lib/format-date';
import type { PayrollRun } from '@/lib/schemas/payroll';

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
}: {
  run: PayrollRun;
  selected: boolean;
  onSelect: (id: string) => void;
  onAction: (action: string, id: string) => void;
  busy: boolean;
  payrollGatewayEnabled: boolean;
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
        {run.status === 'draft' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction('calculate', run.id)}
          >
            Calculate
          </Button>
        ) : null}
        {run.status === 'processing' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction('approve', run.id)}
          >
            Approve
          </Button>
        ) : null}
        {run.status === 'approved' ? (
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
        {['processing', 'approved', 'completed'].includes(run.status) ? (
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const paymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 5);

  const { data: employees = [] } = useEmployees();
  const { data: billingOverview } = useBillingOverview();
  const { data, isLoading, isError, error } = usePayrollRuns();
  const { data: readiness } = usePayrollReadiness(selectedRunId ?? undefined);
  const createRun = useCreatePayrollRun();
  const actions = usePayrollActions();

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
    const activeIds = activeEmployees.map((e) => e.id);
    if (!activeIds.length) {
      toast.error('No active employees to include');
      return;
    }
    try {
      const run = await createRun.mutateAsync({
        title: title.trim(),
        frequency: 'monthly',
        periodStart: monthStart.toISOString(),
        periodEnd: monthEnd.toISOString(),
        paymentDate: paymentDate.toISOString(),
        baseCurrency: 'NGN',
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
        const result = await actions.calculate.mutateAsync(id);
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

  return (
    <AppPage>
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
              <p className="text-sm text-muted-foreground">
                Includes {activeEmployees.length} active employees for the current month. Salaries
                are paid using each employee&apos;s payment settings (NGN, USD, GBP, EUR, KES, GHS,
                ZAR via Nomba).
              </p>
              <Button className="w-full" disabled={createRun.isPending} onClick={handleCreate}>
                Create run
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageActions>

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
            {notReadyItems.length} employee(s) will miss this payroll unless you remove them or ask
            them to complete payment settings.
          </AlertDescription>
        </Alert>
      ) : null}

      <ContentCard
        title="Payroll runs"
        description="Calculate, review payment readiness, approve, and disburse salaries"
        bodyClassName="space-y-3"
      >
        {runs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No payroll runs"
            description="Create a run to calculate salaries and disburse via Nomba or export a bank file."
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
              onAction={handleAction}
            />
          ))
        )}
      </ContentCard>

      {selectedRunId && readiness ? (
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
    </AppPage>
  );
}
