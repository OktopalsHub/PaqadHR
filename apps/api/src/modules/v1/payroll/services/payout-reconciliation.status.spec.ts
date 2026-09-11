import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { resolvePostApprovalPayrollStatus } from './payout-reconciliation';

describe('resolvePostApprovalPayrollStatus', () => {
  it('keeps approved while payouts are in flight (never processing)', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 1,
        processing: 0,
        paid: 0,
        failed: 0,
        active: 1,
      }),
    ).toBe(PayrollStatus.APPROVED);
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 2,
        paid: 1,
        failed: 0,
        active: 3,
      }),
    ).toBe(PayrollStatus.APPROVED);
  });

  it('marks completed when every active item is paid', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 0,
        paid: 3,
        failed: 0,
        active: 3,
      }),
    ).toBe(PayrollStatus.COMPLETED);
  });

  it('marks failed when every active item failed', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 0,
        paid: 0,
        failed: 2,
        active: 2,
      }),
    ).toBe(PayrollStatus.FAILED);
  });

  it('keeps approved on partial paid + failed so retry remains available', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 0,
        paid: 1,
        failed: 1,
        active: 2,
      }),
    ).toBe(PayrollStatus.APPROVED);
  });
});
