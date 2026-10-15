import { AdjustmentMethod } from '../../../../common/enums/adjustment-method.enum';
import { AdjustmentType } from '../../../../common/enums/adjustment-type.enum';
import type { PayrollAdjustmentDto } from '../dto/payroll-adjustment.dto';

const DEDUCTION_TYPES = new Set<AdjustmentType>([AdjustmentType.DEDUCTION, AdjustmentType.PENALTY]);

const CREDIT_TYPES = new Set<AdjustmentType>([
  AdjustmentType.BONUS,
  AdjustmentType.OVERTIME,
  AdjustmentType.COMMISSION,
  AdjustmentType.ALLOWANCE,
  AdjustmentType.SALARY_ADJUSTMENT,
]);

function resolveAdjustmentAmount(adjustment: PayrollAdjustmentDto, baseSalary: number): number {
  const raw =
    adjustment.method === AdjustmentMethod.PERCENTAGE
      ? (baseSalary * adjustment.value) / 100
      : adjustment.value;

  if (DEDUCTION_TYPES.has(adjustment.type)) {
    return -Math.abs(raw);
  }
  if (CREDIT_TYPES.has(adjustment.type)) {
    return Math.abs(raw);
  }
  return adjustment.value;
}

export function aggregateAdjustments(
  lines: PayrollAdjustmentDto[],
  baseSalary: number,
): { adjustments: number; deductions: number } {
  let adjustments = 0;
  let deductions = 0;

  for (const line of lines) {
    const amount = resolveAdjustmentAmount(line, baseSalary);
    if (amount >= 0) {
      adjustments += amount;
    } else {
      deductions += Math.abs(amount);
    }
  }

  return {
    adjustments: Math.round(adjustments * 100) / 100,
    deductions: Math.round(deductions * 100) / 100,
  };
}

export function mergeAdjustmentLines(
  stored: PayrollAdjustmentDto[] | undefined,
  incoming: PayrollAdjustmentDto[] | undefined,
): PayrollAdjustmentDto[] {
  if (incoming !== undefined) {
    return incoming;
  }
  return stored ?? [];
}

export const aggregatePayrollAdjustments = aggregateAdjustments;

export function collectAdjustmentsForEmployee(
  memberId: string,
  requestAdjustments: PayrollAdjustmentDto[] | undefined,
  itemMetadata: Record<string, unknown> | undefined,
): PayrollAdjustmentDto[] {
  const fromRequest =
    requestAdjustments?.filter((adjustment) => adjustment.employeeId === memberId) ?? [];
  if (fromRequest.length > 0) {
    return fromRequest;
  }
  return (itemMetadata?.adjustmentLines as PayrollAdjustmentDto[] | undefined) ?? [];
}

export function computePayrollItemAmounts(
  baseSalary: number,
  lines: PayrollAdjustmentDto[],
): {
  baseSalary: number;
  grossAmount: number;
  adjustments: number;
  deductions: number;
  netAmount: number;
  paymentAmount: number;
} {
  const base = Number(baseSalary);
  if (!Number.isFinite(base) || !(base > 0)) {
    throw new Error('Employee pay rate must be greater than zero');
  }
  const { adjustments, deductions } = aggregateAdjustments(lines, base);
  const netAmount = Math.round((base + adjustments - deductions) * 100) / 100;
  if (netAmount < 0) {
    throw new Error('Net pay cannot be negative after deductions');
  }
  return {
    baseSalary: base,
    grossAmount: base,
    adjustments,
    deductions,
    netAmount,
    paymentAmount: netAmount,
  };
}
