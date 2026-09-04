'use client';

import { Plus } from 'lucide-react';
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
  EXPECTED_PAY_DATE_HINT,
  FREQUENCY_OPTIONS,
  lastDayOfMonthIso,
  PAY_PERIOD_HINT,
  PAYROLL_RUNS_BY_CURRENCY_HINT,
  type PayrollFrequency,
  periodRulesHint,
  THIS_RUN_HINT,
} from '@/lib/payroll-period';
import type { Employee } from '@/lib/schemas/employee';
import type { PayrollAdjustmentLine } from '@/lib/schemas/payroll';

const ADJUSTMENT_TYPES = [
  { value: 'bonus', label: 'Bonus' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'commission', label: 'Commission' },
  { value: 'deduction', label: 'Deduction' },
];

type CreatePayrollRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeEmployees: Employee[];
  currentSalaries: CurrentSalary[];
  fallbackCurrency: string;
  onCreated: (firstRunId: string | null) => void;
};

function employeeName(employee: Employee) {
  return employee.name.trim() || employee.id;
}

export function CreatePayrollRunDialog({
  open,
  onOpenChange,
  activeEmployees,
  currentSalaries,
  fallbackCurrency,
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
  const [adjustmentsByEmployee, setAdjustmentsByEmployee] = useState<
    Record<string, PayrollAdjustmentLine[]>
  >({});
  const [adjustmentTargetId, setAdjustmentTargetId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState('bonus');
  const [adjustmentMethod, setAdjustmentMethod] = useState<'fixed_amount' | 'percentage'>(
    'fixed_amount',
  );
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

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
      setAdjustmentsByEmployee({});
      setAdjustmentTargetId(null);
      setAdjustmentValue('');
      setAdjustmentReason('');
    }
  }, [open]);

  const handlePeriodStartChange = (value: string) => {
    setPeriodStart(value);
    if (frequency === 'monthly') {
      setPeriodEnd(lastDayOfMonthIso(value));
    }
  };

  const toggleEmployee = (employeeId: string, checked: boolean) => {
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
    setSelectedEmployeeIds(allEligibleEmployeeIds);
    setStep(2);
  };

  const resetAdjustmentForm = () => {
    setAdjustmentTargetId(null);
    setAdjustmentType('bonus');
    setAdjustmentMethod('fixed_amount');
    setAdjustmentValue('');
    setAdjustmentReason('');
  };

  const addAdjustment = (employeeId: string, currency: string) => {
    const amount = Number(adjustmentValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const line: PayrollAdjustmentLine = {
      employeeId,
      type: adjustmentType,
      method: adjustmentMethod,
      value: amount,
      reason: adjustmentReason.trim(),
    };
    setAdjustmentsByEmployee((current) => ({
      ...current,
      [employeeId]: [...(current[employeeId] ?? []), line],
    }));
    resetAdjustmentForm();
    toast.success(`Adjustment added (${currency})`);
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
        const adjustments = employeeIds.flatMap(
          (employeeId) => adjustmentsByEmployee[employeeId] ?? [],
        );
        if (adjustments.length > 0) {
          await actions.calculate.mutateAsync({ id: run.id, adjustments });
        }
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

  const busy = createRun.isPending || actions.calculate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Create payroll run' : 'Review employees & adjustments'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="March 2026 payroll"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
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
                <SelectTrigger className="w-full border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
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
              <div className="flex items-center gap-1.5">
                <Label>Pay period</Label>
                <HintIcon label="Pay period" hint={PAY_PERIOD_HINT} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Period start</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => handlePeriodStartChange(e.target.value)}
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
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Expected pay date</Label>
                <HintIcon label="Expected pay date" hint={EXPECTED_PAY_DATE_HINT} />
              </div>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </div>
            {allEligibleEmployeeIds.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Runs to create</Label>
                  <HintIcon label="Runs to create" hint={PAYROLL_RUNS_BY_CURRENCY_HINT} />
                </div>
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
            <div className="flex items-center gap-1.5">
              <Label>This run</Label>
              <HintIcon label="This run" hint={THIS_RUN_HINT} />
            </div>

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
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {employeeIds.map((employeeId) => {
                    const employee = employeesById.get(employeeId);
                    if (!employee) return null;
                    const checkboxId = `payroll-employee-${employeeId}`;
                    const adjustmentCount = adjustmentsByEmployee[employeeId]?.length ?? 0;
                    return (
                      <div key={employeeId} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2 text-sm">
                            <Checkbox
                              id={checkboxId}
                              checked={selectedEmployeeIds.includes(employeeId)}
                              onCheckedChange={(checked) =>
                                toggleEmployee(employeeId, checked === true)
                              }
                            />
                            <Label htmlFor={checkboxId} className="truncate font-normal">
                              {employeeName(employee)}
                            </Label>
                            {adjustmentCount > 0 ? (
                              <Badge variant="secondary">{adjustmentCount} adj.</Badge>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                            onClick={() =>
                              setAdjustmentTargetId((current) =>
                                current === employeeId ? null : employeeId,
                              )
                            }
                          >
                            <Plus className="mr-1 size-3.5" />
                            Adjustment
                          </Button>
                        </div>
                        {adjustmentTargetId === employeeId ? (
                          <div className="ml-6 space-y-2 rounded-[8px] border border-dashed border-slate-200 p-3 dark:border-slate-700">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label>Type</Label>
                                <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                                  <SelectTrigger className="w-full">
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
                              <div className="space-y-1">
                                <Label>Method</Label>
                                <Select
                                  value={adjustmentMethod}
                                  onValueChange={(value) =>
                                    setAdjustmentMethod(value as 'fixed_amount' | 'percentage')
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed_amount">Fixed ({currency})</SelectItem>
                                    <SelectItem value="percentage">Percentage</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label>Amount</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={adjustmentValue}
                                  onChange={(e) => setAdjustmentValue(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Reason</Label>
                                <Input
                                  value={adjustmentReason}
                                  onChange={(e) => setAdjustmentReason(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="brandSolid"
                                onClick={() => addAdjustment(employeeId, currency)}
                              >
                                Add
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={resetAdjustmentForm}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
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
