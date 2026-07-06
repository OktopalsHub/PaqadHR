import { BadRequestException, Injectable } from '@nestjs/common';
import type { SimplePayrollInput } from '../../../../common/interfaces/simple-payroll-input.interface';
import type { SimplePayrollResult } from '../../../../common/interfaces/simple-payroll-result.interface';

@Injectable()
export class PayrollCalculationService {
  async calculateSimplePayroll(input: SimplePayrollInput): Promise<SimplePayrollResult> {
    const grossAmount = input.baseSalary;
    const adjustments = input.adjustments || 0;
    const deductions = input.deductions || 0;
    const netAmount = grossAmount + adjustments - deductions;
    if (netAmount < 0) {
      throw new BadRequestException('Net payment amount cannot be negative');
    }
    return {
      grossAmount,
      adjustments,
      deductions,
      netAmount,
      currency: input.currency,
      description: input.description || 'Salary payment',
    };
  }
  validatePayrollInput(input: SimplePayrollInput): boolean {
    if (input.baseSalary <= 0) {
      throw new BadRequestException('Base salary must be greater than zero');
    }
    if (input.currency?.length !== 3) {
      throw new BadRequestException('Valid 3-letter currency code is required');
    }
    return true;
  }
}
