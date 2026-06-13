import { BadRequestException } from '@nestjs/common';
import { PayrollCalculationService } from './payroll-calculation.service';

describe('PayrollCalculationService', () => {
  let service: PayrollCalculationService;

  beforeEach(() => {
    service = new PayrollCalculationService();
  });

  it('calculates net pay from base salary', async () => {
    const result = await service.calculateSimplePayroll({
      memberId: 'member-1',
      baseSalary: 100_000,
      currency: 'NGN',
      adjustments: 5_000,
      deductions: 2_000,
      description: 'March salary',
    });

    expect(result.grossAmount).toBe(100_000);
    expect(result.netAmount).toBe(103_000);
    expect(result.currency).toBe('NGN');
  });

  it('rejects negative net amounts', async () => {
    await expect(
      service.calculateSimplePayroll({
        memberId: 'member-1',
        baseSalary: 1_000,
        currency: 'NGN',
        adjustments: 0,
        deductions: 5_000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('validates currency code length', () => {
    expect(() =>
      service.validatePayrollInput({
        memberId: 'm1',
        baseSalary: 100,
        currency: 'NG',
        adjustments: 0,
        deductions: 0,
      }),
    ).toThrow(BadRequestException);
  });
});
