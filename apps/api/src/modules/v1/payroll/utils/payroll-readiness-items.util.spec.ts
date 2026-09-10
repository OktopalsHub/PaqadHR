import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { isActivePayrollReadinessItem } from './payroll-readiness-items.util';

describe('isActivePayrollReadinessItem', () => {
  it('excludes cancelled and excluded items from readiness', () => {
    expect(isActivePayrollReadinessItem({ status: PayrollItemStatus.PENDING })).toBe(true);
    expect(isActivePayrollReadinessItem({ status: PayrollItemStatus.CANCELLED })).toBe(false);
    expect(
      isActivePayrollReadinessItem({
        status: PayrollItemStatus.PENDING,
        metadata: { excludedFromRun: true },
      }),
    ).toBe(false);
  });
});
