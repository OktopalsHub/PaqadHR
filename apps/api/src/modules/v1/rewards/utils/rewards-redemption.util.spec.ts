import { computeRedemptionDebit, computeTremendousPointsCost } from './rewards-redemption.util';

describe('computeTremendousPointsCost', () => {
  it('prices points from the same debit the wallet is charged', () => {
    const wholesale = 100;
    const rate = 10;
    expect(computeTremendousPointsCost(wholesale, 2, rate)).toBe(1020);
    expect(computeTremendousPointsCost(wholesale, 3, rate)).toBe(1030);
    expect(computeTremendousPointsCost(wholesale, 3, rate)).toBe(
      Math.ceil(computeRedemptionDebit(wholesale, 3) * rate),
    );
  });
});
