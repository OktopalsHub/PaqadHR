export const PAYROLL_PERIOD_DAY_RANGES = {
  weekly: { min: 6, max: 8, label: 'Weekly' },
  biweekly: { min: 13, max: 15, label: 'Bi-weekly' },
  monthly: { min: 25, max: 32, label: 'Monthly' },
  quarterly: { min: 89, max: 93, label: 'Quarterly' },
  annually: { min: 364, max: 366, label: 'Annually' },
} as const;

export type PayrollFrequency = keyof typeof PAYROLL_PERIOD_DAY_RANGES;

export const FREQUENCY_OPTIONS: Array<{ value: PayrollFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export function payrollPeriodDiffDays(periodStart: string, periodEnd: string): number {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function describePayrollPeriodError(
  frequency: string,
  periodStart: string,
  periodEnd: string,
): string | null {
  const diffDays = payrollPeriodDiffDays(periodStart, periodEnd);
  const range = PAYROLL_PERIOD_DAY_RANGES[frequency as PayrollFrequency];
  if (!range) {
    return 'Select a valid payroll frequency.';
  }

  if (diffDays < range.min) {
    return `${range.label} payroll needs ${range.min}–${range.max} days between period start and end; you have ${diffDays} days.`;
  }
  if (diffDays > range.max) {
    return `${range.label} payroll allows at most ${range.max} days between start and end; you have ${diffDays} days.`;
  }
  return null;
}

export function periodRulesHint(frequency: string): string {
  const range = PAYROLL_PERIOD_DAY_RANGES[frequency as PayrollFrequency];
  if (!range) return '';
  return `${range.label}: ${range.min}–${range.max} days between period start and end.`;
}

export function lastDayOfMonthIso(dateIso: string): string {
  const [year, month] = dateIso.split('-').map(Number);
  return new Date(year, month, 0).toISOString().slice(0, 10);
}
