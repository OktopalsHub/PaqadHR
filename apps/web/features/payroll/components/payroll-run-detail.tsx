'use client';

import { Download, Lock, Plus } from 'lucide-react';
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
import { useEmployees } from '@/hooks/queries/use-employees';
import { usePayrollActions, usePayrollRun, useRunPayslips } from '@/hooks/queries/use-payroll';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import { downloadPayslipPdf } from '@/lib/api/payroll';
import { canManageMember } from '@/lib/auth/manager-access';
import { formatDate } from '@/lib/format-date';
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
    case 'draft':
    case 'unpublished':
      return 'bg-amber-500';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
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
    if (!reason.trim() || !amount || amount <= 0) {
      toast.error('Enter a valid amount and reason');
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
}: {
  runId: string;
  payrollGatewayEnabled: boolean;
  isAdmin: boolean;
}) {
  const { data: run, isLoading, refetch } = usePayrollRun(runId);
  const { data: employees = [] } = useEmployees();
  const { data: tenantSettings } = useTenantSettings();
  const { data: payslips = [] } = useRunPayslips(run?.status === 'completed' ? runId : undefined);
  const actions = usePayrollActions();
  const [sendEmail, setSendEmail] = useState(false);
  const { tenant } = useTenant();
  const viewerMemberId = tenant?.member?.id;
  const viewerRole = tenant?.member?.role;

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
  const isDraft = detail?.status === 'draft';
  const isLocked = detail?.status === 'approved' || detail?.status === 'completed';

  const activeItems = useMemo(
    () => (detail?.items ?? []).filter((item) => item.status !== 'cancelled'),
    [detail?.items],
  );

  const busy =
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.process.isPending ||
    actions.payNow.isPending ||
    actions.schedule.isPending ||
    actions.publishPayslips.isPending;

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  useEffect(() => {
    if (detail?.paymentDate) {
      setScheduleDate(String(detail.paymentDate).slice(0, 10));
    }
  }, [detail?.paymentDate]);

  const handleDownloadPayslip = async (payslip: {
    runId: string;
    itemId: string;
    employeeName: string;
  }) => {
    try {
      await downloadPayslipPdf(
        payslip.runId,
        payslip.itemId,
        `payslip-${payslip.employeeName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

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
    try {
      await actions.payNow.mutateAsync(runId);
      toast.success('Payout started');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payout failed');
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
              {detail.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getPayrollStatusStyles(
                detail.status,
              )}`}
            >
              <span
                className={`size-1.5 rounded-full ${getPayrollStatusDotClass(detail.status)}`}
              />
              {detail.status}
            </span>
            {detail.payoutMode === 'scheduled' && detail.paymentDate ? (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400">
                Scheduled · {formatDate(detail.paymentDate)}
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
            <>
              <Button size="sm" variant="brandSolid" disabled={busy} onClick={handleCalculate}>
                Calculate
              </Button>
              <p className="w-full text-xs text-slate-500 dark:text-slate-400 sm:w-auto sm:self-center">
                Add bonuses/deductions on lines before Calculate.
              </p>
            </>
          ) : null}
          {isAdmin && detail.status === 'processing' ? (
            <Button
              size="sm"
              variant="brandSolid"
              disabled={busy}
              onClick={async () => {
                try {
                  await actions.approve.mutateAsync(runId);
                  toast.success('Payroll approved');
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
              {payrollGatewayEnabled ? (
                <Button size="sm" variant="brandSolid" disabled={busy} onClick={handlePayNow}>
                  Pay now
                </Button>
              ) : null}
              {payrollGatewayEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  disabled={busy}
                  onClick={() => setScheduleOpen(true)}
                >
                  Schedule
                  {detail.paymentDate ? ` for ${formatDate(detail.paymentDate)}` : ''}
                </Button>
              ) : null}
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
            </>
          ) : null}
        </div>
      </div>

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
            <Button variant="brandSolid" className="w-full" disabled={busy} onClick={handleSchedule}>
              Confirm schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLocked ? (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Run locked</AlertTitle>
          <AlertDescription>
            Line items cannot be edited after approval. Bonuses and removals are disabled.
          </AlertDescription>
        </Alert>
      ) : null}

      <AppTablePanel>
        <AppTable className="min-w-[880px]">
          <AppTableHeaderSection>
            <AppTableHeaderRow>
              <AppTableHeadCell>Employee</AppTableHeadCell>
              <AppTableHeadCell>Base</AppTableHeadCell>
              <AppTableHeadCell>Bonuses</AppTableHeadCell>
              <AppTableHeadCell>Deductions</AppTableHeadCell>
              <AppTableHeadCell>Net</AppTableHeadCell>
              <AppTableHeadCell>Status</AppTableHeadCell>
              {isAdmin && isDraft ? <AppTableHeadCell>Actions</AppTableHeadCell> : null}
            </AppTableHeaderRow>
          </AppTableHeaderSection>
          <AppTableBodySection>
            {activeItems.map((item) => {
              const lines =
                (item.metadata?.adjustmentLines as PayrollAdjustmentLine[] | undefined) ?? [];
              const name = employeeName(item);
              const employee = employees.find((emp) => emp.id === item.memberId);
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
                    {Number(item.baseSalary ?? 0).toLocaleString()}{' '}
                    {item.baseSalaryCurrency || detail.baseCurrency}
                  </AppTableCell>
                  <AppTableCell>
                    {Number(item.adjustments ?? 0).toLocaleString()}
                    {lines.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {lines.length} line(s)
                      </p>
                    ) : null}
                  </AppTableCell>
                  <AppTableCell>{Number(item.deductions ?? 0).toLocaleString()}</AppTableCell>
                  <AppTableCell className="font-medium">
                    {Number(item.netAmount ?? 0).toLocaleString()} {detail.baseCurrency}
                  </AppTableCell>
                  <AppTableCell>
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
                  </AppTableCell>
                  {isAdmin && isDraft ? (
                    <AppTableCell>
                      <BonusDialog
                        item={item}
                        runId={runId}
                        currency={detail.baseCurrency}
                        onSaved={() => void refetch()}
                      />
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? 'Paid employees can download payslips after you publish them.'
                  : 'Publish and download payslips for your direct reports.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin ? (
                // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox component is wrapped inside label
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
                  Send email on publish
                  {tenantSettings?.settings?.general?.emailPayslipOnPublish ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      (workspace default: on)
                    </span>
                  ) : null}
                </label>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        onClick={() => void handleDownloadPayslip(payslip)}
                      >
                        <Download className="mr-1 size-3.5" />
                        {payslip.published ? 'Download' : 'Preview'}
                      </Button>
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
  );
}
