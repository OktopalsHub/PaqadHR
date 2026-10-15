import { validateSync } from 'class-validator';
import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';
import { CreatePayrollRunDto } from './create-payroll-run.dto';

function payrollRunDto(payoutMode?: 'immediate' | 'scheduled' | 'unknown'): CreatePayrollRunDto {
  return Object.assign(new CreatePayrollRunDto(), {
    title: 'August payroll',
    frequency: PayrollFrequency.MONTHLY,
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-31T00:00:00.000Z'),
    paymentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    payoutMode,
    baseCurrency: 'NGN',
    employeeIds: ['11111111-1111-4111-8111-111111111111'],
  });
}

describe('CreatePayrollRunDto payout mode', () => {
  it('accepts immediate payroll without a payment date and scheduled payroll with a future date', () => {
    expect(validateSync(payrollRunDto('immediate'))).toHaveLength(0);
    expect(validateSync(payrollRunDto('scheduled'))).toHaveLength(0);
  });

  it('rejects a scheduled payroll without a payment date', () => {
    const dto = payrollRunDto('scheduled');
    dto.paymentDate = undefined;
    expect(validateSync(dto).some((error) => error.property === 'paymentDate')).toBe(true);
  });

  it('rejects a scheduled payroll with today or a past payment date', () => {
    const today = payrollRunDto('scheduled');
    today.paymentDate = new Date();
    expect(validateSync(today).some((error) => error.property === 'paymentDate')).toBe(true);

    const past = payrollRunDto('scheduled');
    past.paymentDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(validateSync(past).some((error) => error.property === 'paymentDate')).toBe(true);
  });

  it('defaults safely when no payout preference is supplied and rejects unknown modes', () => {
    expect(validateSync(payrollRunDto())).toHaveLength(0);
    expect(
      validateSync(payrollRunDto('unknown')).some((error) => error.property === 'payoutMode'),
    ).toBe(true);
  });
});
