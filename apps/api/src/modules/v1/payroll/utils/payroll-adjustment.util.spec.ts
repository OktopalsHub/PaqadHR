import { AdjustmentMethod } from '../../../../common/enums/adjustment-method.enum';
import { AdjustmentType } from '../../../../common/enums/adjustment-type.enum';
import {
  aggregateAdjustments,
  collectAdjustmentsForEmployee,
  computePayrollItemAmounts,
} from './payroll-adjustment.util';

describe('payroll-adjustment.util', () => {
  it('computes net from base plus credits minus deductions', () => {
    const amounts = computePayrollItemAmounts(100_000, [
      {
        employeeId: 'm1',
        type: AdjustmentType.BONUS,
        method: AdjustmentMethod.FIXED_AMOUNT,
        value: 5_000,
      },
      {
        employeeId: 'm1',
        type: AdjustmentType.DEDUCTION,
        method: AdjustmentMethod.PERCENTAGE,
        value: 2,
      },
    ]);
    expect(amounts.baseSalary).toBe(100_000);
    expect(amounts.adjustments).toBe(5_000);
    expect(amounts.deductions).toBe(2_000);
    expect(amounts.netAmount).toBe(103_000);
    expect(amounts.paymentAmount).toBe(103_000);
  });

  it('rejects zero or negative base salary', () => {
    expect(() => computePayrollItemAmounts(0, [])).toThrow(/pay rate/i);
  });

  it('prefers request adjustments over metadata lines', () => {
    const lines = collectAdjustmentsForEmployee(
      'm1',
      [
        {
          employeeId: 'm1',
          type: AdjustmentType.BONUS,
          method: AdjustmentMethod.FIXED_AMOUNT,
          value: 1,
        },
      ],
      {
        adjustmentLines: [
          {
            employeeId: 'm1',
            type: AdjustmentType.DEDUCTION,
            method: AdjustmentMethod.FIXED_AMOUNT,
            value: 9,
          },
        ],
      },
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe(AdjustmentType.BONUS);
    expect(aggregateAdjustments(lines, 100).adjustments).toBe(1);
  });
});
