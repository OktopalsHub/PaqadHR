import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { calculateProratedSeatCharge, getPerSeatMonthlyPrice } from './per-seat-pricing.util';

function growthNgPlanPrice(): PlanPrice {
  return {
    monthlyPrice: 3500,
    regionalConfig: {
      pricePerUser: 3500,
      minimumUsers: 1,
      includedUsers: 50,
      overagePricePerUser: 3000,
      payrollFeePercentage: 2.5,
    },
    config: {
      pricePerUser: 3500,
      minimumUsers: 1,
      includedUsers: 50,
      overagePricePerUser: 3000,
      payrollFeePercentage: 2.5,
    },
    calculateMonthlyPrice(userCount: number) {
      const cfg = this.regionalConfig;
      const overageUsers = Math.max(0, userCount - (cfg.includedUsers ?? 0));
      const basePrice = Math.max(userCount, cfg.minimumUsers ?? 1) * (cfg.pricePerUser ?? 0);
      const overagePrice = overageUsers * (cfg.overagePricePerUser ?? 0);
      return {
        basePrice,
        overagePrice,
        totalPrice: basePrice + overagePrice,
        overageUsers,
      };
    },
  } as PlanPrice;
}

describe('getPerSeatMonthlyPrice', () => {
  it('uses regional pricePerUser when set', () => {
    expect(getPerSeatMonthlyPrice(growthNgPlanPrice())).toBe(3500);
  });

  it('falls back to monthlyPrice', () => {
    const plan = { monthlyPrice: 99, regionalConfig: {}, config: {} } as PlanPrice;
    expect(getPerSeatMonthlyPrice(plan)).toBe(99);
  });
});

describe('calculateProratedSeatCharge', () => {
  const planPrice = growthNgPlanPrice();
  const periodStart = new Date('2026-01-01T00:00:00.000Z');
  const periodEnd = new Date('2026-01-31T00:00:00.000Z');

  it('prorates one extra seat halfway through a 30-day period', () => {
    const asOf = new Date('2026-01-16T00:00:00.000Z');
    const { amount } = calculateProratedSeatCharge(planPrice, 1, periodStart, periodEnd, asOf);
    expect(amount).toBe(1750);
  });

  it('returns zero for zero extra seats', () => {
    const { amount } = calculateProratedSeatCharge(planPrice, 0, periodStart, periodEnd);
    expect(amount).toBe(0);
  });

  it('returns zero when the billing period has ended', () => {
    const asOf = new Date('2026-02-01T00:00:00.000Z');
    const { amount } = calculateProratedSeatCharge(planPrice, 1, periodStart, periodEnd, asOf);
    expect(amount).toBe(0);
  });

  it('enforces minimum charge for tiny prorated amounts', () => {
    const asOf = new Date('2026-01-30T12:00:00.000Z');
    const { amount } = calculateProratedSeatCharge(planPrice, 1, periodStart, periodEnd, asOf);
    expect(amount).toBe(100);
  });
});
