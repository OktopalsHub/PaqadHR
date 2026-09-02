import { describePayrollPeriodError, payrollPeriodDiffDays } from './payroll-date.validator';

describe('payroll period validation helpers', () => {
  it('computes diff days between period start and end', () => {
    expect(payrollPeriodDiffDays('2026-09-01', '2026-09-30')).toBe(29);
  });

  it('accepts monthly period at 25-day minimum', () => {
    expect(describePayrollPeriodError('monthly', 25)).toBeNull();
  });

  it('accepts past-month august span for monthly payroll', () => {
    const diffDays = payrollPeriodDiffDays('2026-08-01', '2026-08-31');
    expect(diffDays).toBe(30);
    expect(describePayrollPeriodError('monthly', diffDays)).toBeNull();
  });

  it('returns specific message when monthly period is too short', () => {
    const message = describePayrollPeriodError('monthly', 24);
    expect(message).toContain('25–32 days');
    expect(message).toContain('24 days');
  });

  it('returns specific message when monthly period is too long', () => {
    const message = describePayrollPeriodError('monthly', 40);
    expect(message).toContain('at most 32 days');
    expect(message).toContain('40 days');
  });

  it('returns weekly-specific message when period is too long', () => {
    const message = describePayrollPeriodError('weekly', 12);
    expect(message).toContain('Weekly payroll');
    expect(message).toContain('12 days');
  });

  it('returns biweekly-specific message when period is too short', () => {
    const message = describePayrollPeriodError('biweekly', 10);
    expect(message).toContain('Bi-weekly payroll');
    expect(message).toContain('10 days');
  });
});
