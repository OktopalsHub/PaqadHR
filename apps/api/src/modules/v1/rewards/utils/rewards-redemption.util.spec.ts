import { computeRedemptionDebit, REDEMPTION_FLAT_FEE_MIN_AMOUNT } from './rewards-redemption.util';

describe('computeRedemptionDebit', () => {
  const feePercentage = 2;
  const flatFee = 50;

  it('waives flat fee below threshold', () => {
    expect(computeRedemptionDebit(500, feePercentage, flatFee)).toBe(510);
  });

  it('applies flat fee at or above threshold', () => {
    expect(computeRedemptionDebit(REDEMPTION_FLAT_FEE_MIN_AMOUNT, feePercentage, flatFee)).toBe(
      2090,
    );
    expect(computeRedemptionDebit(5000, feePercentage, flatFee)).toBe(5150);
  });
});
