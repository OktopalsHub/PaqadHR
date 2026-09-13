import { validateSync } from 'class-validator';
import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';
import { CreatePayrollRunDto } from './create-payroll-run.dto';

function payrollRunDto(payoutMode?: 'immediate' | 'scheduled' | 'unknown'): CreatePayrollRunDto {
  return Object.assign(new CreatePayrollRunDto(), {
    title: 'August payroll',
    frequency: PayrollFrequency.MONTHLY,
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-31T00:00:00.000Z'),
    paymentDate: new Date('2026-09-05T00:00:00.000Z'),
    payoutMode,
    baseCurrency: 'NGN',
    employeeIds: ['11111111-1111-4111-8111-111111111111'],
  });
}

describe('CreatePayrollRunDto payout mode', () => {
  it('accepts an immediate or scheduled approved payout preference', () => {
    expect(validateSync(payrollRunDto('immediate'))).toHaveLength(0);
    expect(validateSync(payrollRunDto('scheduled'))).toHaveLength(0);
  });

  it('defaults safely when no payout preference is supplied and rejects unknown modes', () => {
    expect(validateSync(payrollRunDto())).toHaveLength(0);
    expect(
      validateSync(payrollRunDto('unknown')).some((error) => error.property === 'payoutMode'),
    ).toBe(true);
  });
});
