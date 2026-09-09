'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HintIcon } from '@/features/settings/components/settings-field-hint';
import { usePayrollActions, useUpdatePayrollRun } from '@/hooks/queries/use-payroll';
import type { CurrentSalary } from '@/lib/api/employment';
import { groupEmployeeIdsBySalaryCurrency } from '@/lib/payroll-create';
import {
  describePayrollPeriodError,
  FREQUENCY_OPTIONS,
  lastDayOfMonthIso,
  type PayrollFrequency,
  periodRulesHint,
} from '@/lib/payroll-period';
import type { Employee } from '@/lib/schemas/employee';
import type { PayrollRunDetail } from '@/lib/schemas/payroll';

type EditPayrollRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: PayrollRunDetail;
  activeEmployees: Employee[];
  currentSalaries: CurrentSalary[];
  paymentReadyMemberIds: Set<string>;
  onSaved: () => void;
};

function employeeName(employee: Employee) {
  return employee.name.trim() || employee.id;
}

function toDateInput(value?: string | Date | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

const fieldClassName =
  'border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100';

export function EditPayrollRunDialog({
  open,
  onOpenChange,
  run,
  activeEmployees,
  currentSalaries,
  paymentReadyMemberIds,
  onSaved,
}: EditPayrollRunDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState(run.title);
  const [periodStart, setPeriodStart] = useState(toDateInput(run.periodStart));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(run.periodEnd));
  const [paymentDate, setPaymentDate] = useState(toDateInput(run.paymentDate));
  const [frequency, setFrequency] = useState<PayrollFrequency>(
    (run.frequency as PayrollFrequency) || 'monthly',
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const updateRun = useUpdatePayrollRun();
  const actions = usePayrollActions();

  const currency = run.baseCurrency.toUpperCase();

  const eligibleEmployeeIds = useMemo(() => {
    const grouped = groupEmployeeIdsBySalaryCurrency(
      activeEmployees.map((employee) => employee.id),
      currentSalaries,
      currency,
    );
    return grouped.find((row) => row.currency === currency)?.employeeIds ?? [];
  }, [activeEmployees, currentSalaries, currency]);

  const employeesById = useMemo(
    () => new Map(activeEmployees.map((employee) => [employee.id, employee])),
    [activeEmployees],
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      return;
    }
    setTitle(run.title);
    setPeriodStart(toDateInput(run.periodStart));
    setPeriodEnd(toDateInput(run.periodEnd));
    setPaymentDate(toDateInput(run.paymentDate));
    setFrequency((run.frequency as PayrollFrequency) || 'monthly');
    const activeIds = (run.items ?? [])
      .filter((item) => item.status !== 'cancelled')
      .map((item) => item.memberId)
      .filter((id) => paymentReadyMemberIds.has(id));
    setSelectedEmployeeIds(activeIds);
  }, [open, run, paymentReadyMemberIds]);

  const handlePeriodStartChange = (value: string) => {
    setPeriodStart(value);
    if (frequency === 'monthly') {
      setPeriodEnd(lastDayOfMonthIso(value));
    }
  };

  const toggleEmployee = (employeeId: string, checked: boolean) => {
    if (!paymentReadyMemberIds.has(employeeId)) return;
    setSelectedEmployeeIds((current) => {
      if (checked) {
        return current.includes(employeeId) ? current : [...current, employeeId];
      }
      return current.filter((id) => id !== employeeId);
    });
  };

  const validateStepOne = () => {
    if (!title.trim()) {
      toast.error('Enter a payroll title');
      return false;
    }
    if (!periodStart || !periodEnd || !paymentDate) {
      toast.error('Set period and expected pay dates');
      return false;
    }
    if (new Date(periodEnd) <= new Date(periodStart)) {
      toast.error('Period end must be after period start');
      return false;
    }
    const periodError = describePayrollPeriodError(frequency, periodStart, periodEnd);
    if (periodError) {
      toast.error(periodError);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!selectedEmployeeIds.length) {
      toast.error('Select at least one employee with payment details');
      return;
    }
    try {
      await updateRun.mutateAsync({
        id: run.id,
        input: {
          title: title.trim(),
          frequency,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          paymentDate: new Date(paymentDate).toISOString(),
          employeeIds: selectedEmployeeIds,
        },
      });
      toast.success('Payroll run updated and recalculated');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payroll run');
    }
  };

  const handleNotify = async (memberId: string) => {
    try {
      await actions.notifyMemberPaymentSetup.mutateAsync(memberId);
      toast.success('Employee notified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to notify employee');
    }
  };

  const busy = updateRun.isPending || actions.notifyMemberPaymentSetup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Edit payroll run' : 'Select employees'}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClassName}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Frequency</Label>
                <HintIcon label="Frequency" hint={periodRulesHint(frequency)} />
              </div>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as PayrollFrequency)}
              >
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay period</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Period start</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => handlePeriodStartChange(e.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period end</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className={fieldClassName}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expected pay date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={fieldClassName}
              />
            </div>
            <Badge variant="outline">
              {currency} · {eligibleEmployeeIds.length} salary-eligible
            </Badge>
            <Button
              variant="brandSolid"
              className="w-full"
              onClick={() => {
                if (!validateStepOne()) return;
                setStep(2);
              }}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Only employees with payment details for {currency} can be included.
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-[8px] border border-[#d7e3f6] p-3 dark:border-slate-800">
              {eligibleEmployeeIds.map((employeeId) => {
                const employee = employeesById.get(employeeId);
                if (!employee) return null;
                const ready = paymentReadyMemberIds.has(employeeId);
                const checkboxId = `edit-payroll-employee-${employeeId}`;
                return (
                  <div key={employeeId} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={checkboxId}
                      checked={ready && selectedEmployeeIds.includes(employeeId)}
                      disabled={!ready}
                      onCheckedChange={(checked) => toggleEmployee(employeeId, checked === true)}
                    />
                    <Label
                      htmlFor={checkboxId}
                      className={`min-w-0 flex-1 truncate font-normal ${ready ? '' : 'text-muted-foreground'}`}
                    >
                      {employeeName(employee)}
                      {!ready ? ' · No payment method' : ''}
                    </Label>
                    {!ready ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={busy}
                        onClick={() => void handleNotify(employeeId)}
                      >
                        Notify
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="brandSolid"
                className="flex-1"
                disabled={busy || selectedEmployeeIds.length === 0}
                onClick={() => void handleSave()}
              >
                {busy ? 'Saving…' : 'Save & recalculate'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
