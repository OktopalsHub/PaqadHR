import { computeRedemptionDebit } from './rewards-redemption.util';

describe('computeRedemptionDebit', () => {
  const feePercentage = 2;

  it('charges percentage only on small amounts', () => {
    expect(computeRedemptionDebit(100, feePercentage)).toBe(102);
    expect(computeRedemptionDebit(500, feePercentage)).toBe(510);
    expect(computeRedemptionDebit(1000, feePercentage)).toBe(1020);
  });

  it('charges percentage only on large amounts', () => {
    expect(computeRedemptionDebit(10000, feePercentage)).toBe(10200);
    expect(computeRedemptionDebit(50000, feePercentage)).toBe(51000);
  });
});
