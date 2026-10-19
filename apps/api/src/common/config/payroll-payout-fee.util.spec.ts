import {
  calculatePayrollPayoutFeeReserve,
  DEFAULT_NGN_PAYOUT_FEE_RESERVE,
  DEFAULT_PAYROLL_PAYOUT_FEE_MARKUP_PERCENT,
  getBachsWithdrawalFeePerTransfer,
  getPayrollPayoutFeePerTransfer,
  hasConfiguredPayrollPayoutFee,
  resolvePayrollPayoutFeePerTransfer,
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

  it('rounds each transfer reserve before combining them, matching previews', () => {
    expect(
      calculatePayrollPayoutFeeReserve({
        currency: 'NGN',
        transferCount: 2,
        env: { PAYROLL_PAYOUT_FEE_NGN: '0.015' },
      }),
    ).toEqual({ feePerTransfer: 0.015, transferCount: 2, total: 0.04 });
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
    expect(
      getPayrollPayoutFeePerTransfer('NGN', 'bachs', {
        PAYROLL_PAYOUT_FEE_BACHS_NGN: '0',
      }),
    ).toBe(0);
    expect(getPayrollPayoutFeePerTransfer('USD', 'bachs', {})).toBe(0);
  });

  it('requires an explicit configured fee when no safe currency default exists', () => {
    expect(hasConfiguredPayrollPayoutFee('USD', 'bachs', {})).toBe(false);
    expect(
      hasConfiguredPayrollPayoutFee('USD', 'bachs', {
        PAYROLL_PAYOUT_FEE_BACHS_USD: '0.75',
      }),
    ).toBe(true);
    expect(
      hasConfiguredPayrollPayoutFee('USD', 'bachs', {
        PAYROLL_PAYOUT_FEE_USD: '1',
      }),
    ).toBe(true);
  });

  it('ignores invalid configuration and uses the safe default', () => {
    expect(
      getPayrollPayoutFeePerTransfer('NGN', 'bachs', {
        PAYROLL_PAYOUT_FEE_BACHS_NGN: '-10',
      }),
    ).toBe(100);
  });

  describe('Bachs withdrawal schedule with markup', () => {
    it('reserves a doubled ₦50 NGN withdrawal fee per transfer', () => {
      expect(getBachsWithdrawalFeePerTransfer(250_000, 'NGN')).toBe(50);
      expect(
        resolvePayrollPayoutFeePerTransfer({ currency: 'NGN', provider: 'bachs', env: {} }),
      ).toBe(100);
    });

    it('prices USD from the source amount (1%, min $1, cap $15) then doubles it', () => {
      // 1% of $500 = $5 → reserve $10
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'USD',
          provider: 'bachs',
          sourceAmount: 500,
          env: {},
        }),
      ).toBe(10);
      // Below the $1 minimum
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'USD',
          provider: 'bachs',
          sourceAmount: 20,
          env: {},
        }),
      ).toBe(2);
      // Above the $15 cap
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'USD',
          provider: 'bachs',
          sourceAmount: 10_000,
          env: {},
        }),
      ).toBe(30);
    });

    it('prices stablecoin and other-currency transfers from the same schedule', () => {
      expect(getBachsWithdrawalFeePerTransfer(250, 'USDT')).toBe(2.5);
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'USDT',
          provider: 'bachs',
          sourceAmount: 250,
          env: {},
        }),
      ).toBe(5);
      expect(getBachsWithdrawalFeePerTransfer(1_000, 'EUR')).toBe(3);
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'EUR',
          provider: 'bachs',
          sourceAmount: 1_000,
          env: {},
        }),
      ).toBe(6);
    });

    it('honours an explicit override before the derived schedule', () => {
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'USD',
          provider: 'bachs',
          sourceAmount: 500,
          env: { PAYROLL_PAYOUT_FEE_BACHS_USD: '0.75' },
        }),
      ).toBe(0.75);
    });

    it('supports a different markup without code changes', () => {
      expect(DEFAULT_PAYROLL_PAYOUT_FEE_MARKUP_PERCENT).toBe(100);
      expect(
        resolvePayrollPayoutFeePerTransfer({
          currency: 'NGN',
          provider: 'bachs',
          env: { PAYROLL_PAYOUT_FEE_MARKUP_PERCENT: '50' },
        }),
      ).toBe(75);
    });
  });
});
