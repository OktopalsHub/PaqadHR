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
import { useCreatePayrollRun, usePayrollActions } from '@/hooks/queries/use-payroll';
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

type CreatePayrollRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeEmployees: Employee[];
  currentSalaries: CurrentSalary[];
  fallbackCurrency: string;
  paymentReadyByCurrency: Map<string, Set<string>>;
  onCreated: (firstRunId: string | null) => void;
};

function employeeName(employee: Employee) {
  return employee.name.trim() || employee.id;
}

const fieldClassName =
  'border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100';

export function CreatePayrollRunDialog({
  open,
  onOpenChange,
  activeEmployees,
  currentSalaries,
  fallbackCurrency,
  paymentReadyByCurrency,
  onCreated,
}: CreatePayrollRunDialogProps) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const defaultPayDate = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    .toISOString()
    .slice(0, 10);

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [paymentDate, setPaymentDate] = useState(defaultPayDate);
  const [frequency, setFrequency] = useState<PayrollFrequency>('monthly');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const createRun = useCreatePayrollRun();
  const actions = usePayrollActions();

  const payrollRunsToCreate = useMemo(
    () => groupEmployeeIdsBySalaryCurrency(selectedEmployeeIds, currentSalaries, fallbackCurrency),
    [selectedEmployeeIds, currentSalaries, fallbackCurrency],
  );

  const allEligibleEmployeeIds = useMemo(
    () =>
      groupEmployeeIdsBySalaryCurrency(
        activeEmployees.map((employee) => employee.id),
        currentSalaries,
        fallbackCurrency,
      ).flatMap((row) => row.employeeIds),
    [activeEmployees, currentSalaries, fallbackCurrency],
  );

  const employeesById = useMemo(
    () => new Map(activeEmployees.map((employee) => [employee.id, employee])),
    [activeEmployees],
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      setTitle('');
      setSelectedEmployeeIds([]);
    }
  }, [open]);

  const handlePeriodStartChange = (value: string) => {
    setPeriodStart(value);
    if (frequency === 'monthly') {
      setPeriodEnd(lastDayOfMonthIso(value));
    }
  };

  const salaryCurrencyByEmployee = useMemo(() => {
    const map = new Map<string, string>();
    for (const salary of currentSalaries) {
      map.set(salary.memberId, (salary.currency ?? fallbackCurrency).toUpperCase());
    }
    return map;
  }, [currentSalaries, fallbackCurrency]);

  const isPaymentReady = (employeeId: string) => {
    const currency = salaryCurrencyByEmployee.get(employeeId) ?? fallbackCurrency.toUpperCase();
    return paymentReadyByCurrency.get(currency)?.has(employeeId) ?? false;
  };

  const toggleEmployee = (employeeId: string, checked: boolean) => {
    if (!isPaymentReady(employeeId)) return;
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
    if (!allEligibleEmployeeIds.length) {
      toast.error('No active employees with salary set for this period');
      return false;
    }
    return true;
  };

  const goToStepTwo = () => {
    if (!validateStepOne()) return;
    setSelectedEmployeeIds(
      allEligibleEmployeeIds.filter((employeeId) => isPaymentReady(employeeId)),
    );
    setStep(2);
  };

  const handleNotify = async (memberId: string) => {
    try {
      await actions.notifyMemberPaymentSetup.mutateAsync(memberId);
      toast.success('Employee notified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to notify employee');
    }
  };

  const handleCreate = async () => {
    if (!payrollRunsToCreate.length) {
      toast.error('Select at least one employee for this run');
      return;
    }
    try {
      const createdRunIds: string[] = [];
      let existingCount = 0;

      for (const { currency, employeeIds } of payrollRunsToCreate) {
        const runTitle =
          payrollRunsToCreate.length > 1 ? `${title.trim()} · ${currency}` : title.trim();
        const run = await createRun.mutateAsync({
          title: runTitle,
          frequency,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          paymentDate: new Date(paymentDate).toISOString(),
          baseCurrency: currency,
          employeeIds,
        });
        if (run.alreadyExists) {
          existingCount += 1;
          continue;
        }

        createdRunIds.push(run.id);
      }

      onOpenChange(false);
      onCreated(createdRunIds[0] ?? null);

      if (createdRunIds.length > 1) {
        toast.success(`Created ${createdRunIds.length} payroll runs`);
      } else if (createdRunIds.length === 1) {
        toast.success('Payroll run created');
      }
      if (existingCount > 0) {
        toast.message(
          existingCount === 1
            ? '1 run already existed for this period'
            : `${existingCount} runs already existed for this period`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payroll');
    }
  };

  const busy = createRun.isPending || actions.notifyMemberPaymentSetup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Create payroll run' : 'Select employees'}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="March 2026 payroll"
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
            {allEligibleEmployeeIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {groupEmployeeIdsBySalaryCurrency(
                  allEligibleEmployeeIds,
                  currentSalaries,
                  fallbackCurrency,
                ).map((row) => (
                  <Badge key={row.currency} variant="outline">
                    {row.currency} · {row.employeeIds.length}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active employees with salary set for this period.
              </p>
            )}
            <Button
              variant="brandSolid"
              className="w-full"
              disabled={allEligibleEmployeeIds.length === 0}
              onClick={goToStepTwo}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Only employees with payment details can be included. Others are shown disabled.
            </p>

            {groupEmployeeIdsBySalaryCurrency(
              allEligibleEmployeeIds,
              currentSalaries,
              fallbackCurrency,
            ).map(({ currency, employeeIds }) => (
              <div
                key={currency}
                className="space-y-2 rounded-[8px] border border-[#d7e3f6] p-3 dark:border-slate-800"
              >
                <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{currency}</p>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {employeeIds.map((employeeId) => {
                    const employee = employeesById.get(employeeId);
                    if (!employee) return null;
                    const ready = isPaymentReady(employeeId);
                    const checkboxId = `payroll-employee-${employeeId}`;
                    return (
                      <div key={employeeId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={checkboxId}
                          checked={ready && selectedEmployeeIds.includes(employeeId)}
                          disabled={!ready}
                          onCheckedChange={(checked) =>
                            toggleEmployee(employeeId, checked === true)
                          }
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
              </div>
            ))}

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
                disabled={busy || payrollRunsToCreate.length === 0}
                onClick={() => void handleCreate()}
              >
                {busy
                  ? 'Creating…'
                  : payrollRunsToCreate.length > 1
                    ? `Create ${payrollRunsToCreate.length} runs`
                    : 'Create run'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
