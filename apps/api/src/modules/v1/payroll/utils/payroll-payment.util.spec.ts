import { resolvePayrollPayoutAmount } from './payroll-payment.util';

describe('resolvePayrollPayoutAmount', () => {
  it('uses paymentAmount when set', () => {
    expect(resolvePayrollPayoutAmount({ paymentAmount: 1500, netAmount: 900 } as never)).toBe(1500);
  });

  it('falls back to netAmount when paymentAmount is zero decimal string', () => {
    expect(
      resolvePayrollPayoutAmount({
        paymentAmount: '0.00000000',
        netAmount: '2500.00',
      } as never),
    ).toBe(2500);
  });

  it('returns 0 when both amounts are empty', () => {
    expect(resolvePayrollPayoutAmount({ paymentAmount: 0, netAmount: 0 } as never)).toBe(0);
  });
});
