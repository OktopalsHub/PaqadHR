import {
  calculatePayrollPayoutFeeReserve,
  DEFAULT_NGN_PAYOUT_FEE_RESERVE,
  getPayrollPayoutFeePerTransfer,
} from './payroll-payout-fee.util';

describe('payroll payout fee reserve', () => {
  it('defaults NGN transfers to a ₦100 reserve per transfer', () => {
    expect(getPayrollPayoutFeePerTransfer('NGN', undefined, {})).toBe(
      DEFAULT_NGN_PAYOUT_FEE_RESERVE,
    );
    expect(
      calculatePayrollPayoutFeeReserve({ currency: 'NGN', transferCount: 3, env: {} }),
    ).toEqual({ feePerTransfer: 100, transferCount: 3, total: 300 });
  });

  it('allows provider-specific values to override currency defaults', () => {
    const env = {
      PAYROLL_PAYOUT_FEE_NGN: '100',
      PAYROLL_PAYOUT_FEE_MONNIFY_NGN: '75',
    };
    expect(getPayrollPayoutFeePerTransfer('NGN', 'monnify', env)).toBe(75);
    expect(getPayrollPayoutFeePerTransfer('NGN', 'nomba', env)).toBe(100);
  });

  it('supports disabling or changing a provider fee without code changes', () => {
    expect(getPayrollPayoutFeePerTransfer('NGN', 'bachs', { PAYROLL_PAYOUT_FEE_BACHS_NGN: '0' })).toBe(0);
    expect(getPayrollPayoutFeePerTransfer('USD', 'bachs', {})).toBe(0);
  });

  it('ignores invalid configuration and uses the safe default', () => {
    expect(getPayrollPayoutFeePerTransfer('NGN', 'bachs', { PAYROLL_PAYOUT_FEE_BACHS_NGN: '-10' })).toBe(100);
  });
});
