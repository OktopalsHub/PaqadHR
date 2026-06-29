'use client';

import { Download, Lock, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { getInitials } from '@/lib/utils';
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
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-900';
    case 'processing':
    case 'approved':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-450 dark:border-blue-900';
    case 'draft':
    case 'unpublished':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
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
        <Button size="sm" variant="outline">
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
              <SelectTrigger>
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
                <SelectTrigger>
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
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button className="w-full" disabled={actions.updateItem.isPending} onClick={handleSave}>
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
    actions.publishPayslips.isPending;

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
    return <p className="text-sm text-muted-foreground">Loading run details…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{detail.title}</h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getPayrollStatusStyles(
                detail.status,
              )}`}
            >
              <span
                className={`size-1.5 rounded-full ${getPayrollStatusDotClass(detail.status)}`}
              />
              {detail.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(detail.periodStart)} – {formatDate(detail.periodEnd)}
            {detail.paymentDate ? ` · Pay ${formatDate(detail.paymentDate)}` : ''} ·{' '}
            {detail.baseCurrency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && isDraft ? (
            <Button size="sm" disabled={busy} onClick={handleCalculate}>
              Calculate
            </Button>
          ) : null}
          {isAdmin && detail.status === 'processing' ? (
            <Button
              size="sm"
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
              <Button
                size="sm"
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
              {payrollGatewayEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await actions.process.mutateAsync(runId);
                      toast.success('Nomba payout started');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Payout failed');
                    }
                  }}
                >
                  Pay via Nomba
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {isLocked ? (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Run locked</AlertTitle>
          <AlertDescription>
            Line items cannot be edited after approval. Bonuses and removals are disabled.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3 font-medium">Employee</th>
              <th className="p-3 font-medium">Base</th>
              <th className="p-3 font-medium">Bonuses</th>
              <th className="p-3 font-medium">Deductions</th>
              <th className="p-3 font-medium">Net</th>
              <th className="p-3 font-medium">Status</th>
              {isAdmin && isDraft ? <th className="p-3 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item) => {
              const lines =
                (item.metadata?.adjustmentLines as PayrollAdjustmentLine[] | undefined) ?? [];
              const name = employeeName(item);
              const employee = employees.find((emp) => emp.id === item.memberId);
              return (
                <tr key={item.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={employee?.avatar || '/placeholder.svg'} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span>{name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    {Number(item.baseSalary ?? 0).toLocaleString()} {detail.baseCurrency}
                  </td>
                  <td className="p-3">
                    {Number(item.adjustments ?? 0).toLocaleString()}
                    {lines.length > 0 ? (
                      <p className="text-xs text-muted-foreground">{lines.length} line(s)</p>
                    ) : null}
                  </td>
                  <td className="p-3">{Number(item.deductions ?? 0).toLocaleString()}</td>
                  <td className="p-3 font-medium">
                    {Number(item.netAmount ?? 0).toLocaleString()} {detail.baseCurrency}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${getPayrollStatusStyles(
                        item.status,
                      )}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${getPayrollStatusDotClass(item.status)}`}
                      />
                      {item.status}
                    </span>
                  </td>
                  {isAdmin && isDraft ? (
                    <td className="p-3">
                      <BonusDialog
                        item={item}
                        runId={runId}
                        currency={detail.baseCurrency}
                        onSaved={() => void refetch()}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail.status === 'completed' && payslips.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium">Payslips</h4>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? 'Paid employees can download payslips after you publish them.'
                  : 'Publish and download payslips for your direct reports.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin ? (
                // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox component is wrapped inside label
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
                  Send email on publish
                  {tenantSettings?.settings?.general?.emailPayslipOnPublish ? (
                    <span className="text-xs text-muted-foreground">(workspace default: on)</span>
                  ) : null}
                </label>
              ) : null}
              <Button
                size="sm"
                disabled={
                  busy || payslips.every((p) => p.published || !canManagePayrollItem(p.memberId))
                }
                onClick={handlePublishAll}
              >
                Publish all
              </Button>
            </div>
          </div>
          <div className="divide-y rounded-md border">
            {payslips
              .filter((payslip) => canManagePayrollItem(payslip.memberId))
              .map((payslip) => {
                const employee = employees.find((emp) => emp.id === payslip.memberId);
                const name = payslip.employeeName;
                return (
                  <div
                    key={payslip.itemId}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={employee?.avatar || '/placeholder.svg'} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {payslip.paidAt ? `Paid ${formatDate(payslip.paidAt)}` : 'Paid'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPayrollStatusStyles(
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
                        onClick={() => void handleDownloadPayslip(payslip)}
                      >
                        <Download className="mr-1 size-3.5" />
                        {payslip.published ? 'Download' : 'Preview'}
                      </Button>
                      {!payslip.published ? (
                        <Button
                          size="sm"
                          variant="outline"
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
