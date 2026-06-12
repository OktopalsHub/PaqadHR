import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SimplePayrollInput } from "../../../../common/interfaces/simple-payroll-input.interface";
import { SimplePayrollResult } from "../../../../common/interfaces/simple-payroll-result.interface";

@Injectable()
export class PayrollCalculationService {
  private readonly logger = new Logger(PayrollCalculationService.name);
  constructor() {
    this.logger.log('Simple payroll calculation service initialized');
  }
  async calculateSimplePayroll(
    input: SimplePayrollInput,
  ): Promise<SimplePayrollResult> {
    this.logger.log(
      `Calculating simple payroll for employee ${input.memberId}`,
    );
    const grossAmount = input.baseSalary;
    const adjustments = input.adjustments || 0;
    const deductions = input.deductions || 0;
    const netAmount = grossAmount + adjustments - deductions;
    if (netAmount < 0) {
      throw new BadRequestException('Net payment amount cannot be negative');
    }
    this.logger.log(
      `Simple payroll: ${grossAmount} + ${adjustments} - ${deductions} = ${netAmount} ${input.currency}`,
    );
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
    if (!input.currency || input.currency.length !== 3) {
      throw new BadRequestException('Valid 3-letter currency code is required');
    }
    return true;
  }
}
