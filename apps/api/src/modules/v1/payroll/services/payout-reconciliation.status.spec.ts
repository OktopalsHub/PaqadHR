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

  // Regression: async rails (Bachs) leave every item `processing` until a payout webhook
  // arrives, so the run stays `approved` with nothing left to send. The UI used to offer
  // "Pay employees" here, and the payout then failed with "No employees could be paid".
  it('stays approved while every item is still in flight', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 2,
        paid: 0,
        failed: 0,
        active: 2,
      }),
    ).toBe(PayrollStatus.APPROVED);
  });

  it('completes once every in-flight item is confirmed paid', () => {
    expect(
      resolvePostApprovalPayrollStatus({
        pending: 0,
        processing: 0,
        paid: 2,
        failed: 0,
        active: 2,
      }),
    ).toBe(PayrollStatus.COMPLETED);
  });
});
