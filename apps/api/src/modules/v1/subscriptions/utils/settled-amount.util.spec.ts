import { PlanPrice } from '../../plans/entities/plan-price.entity';
import { resolveSettledAmount } from './settled-amount.util';

function planPrice(overrides: Partial<PlanPrice> = {}): PlanPrice {
  return Object.assign(Object.create(PlanPrice.prototype), {
    currency: 'USD',
    monthlyPrice: 99,
    regionalConfig: {},
    isActive: true,
    ...overrides,
  }) as PlanPrice;
}

describe('resolveSettledAmount', () => {
  const usdPlan = planPrice({ monthlyPrice: 99 });
  const ngnRow = planPrice({ currency: 'NGN', monthlyPrice: 150000 });

  it('validates a same-currency payment against the plan price', () => {
    const settled = resolveSettledAmount({
      paidAmount: 99,
      paidCurrency: 'USD',
      planPrice: usdPlan,
      planPriceInPaidCurrency: null,
      seatCount: 1,
    });

    expect(settled.basis).toBe('plan_currency');
    expect(settled.expectedAmount).toBe(99);
    expect(settled.withinTolerance).toBe(true);
    expect(settled.amount).toBe(99);
  });

  it('still rejects an understated same-currency payment', () => {
    const settled = resolveSettledAmount({
      paidAmount: 50,
      paidCurrency: 'USD',
      planPrice: usdPlan,
      planPriceInPaidCurrency: null,
      seatCount: 1,
    });

    expect(settled.withinTolerance).toBe(false);
  });

  it('validates an NGN payment on a USD plan against the NGN price row', () => {
    const settled = resolveSettledAmount({
      paidAmount: 150000,
      paidCurrency: 'NGN',
      planPrice: usdPlan,
      planPriceInPaidCurrency: ngnRow,
      seatCount: 1,
    });

    expect(settled.basis).toBe('paid_currency');
    expect(settled.expectedAmount).toBe(150000);
    expect(settled.amount).toBe(150000);
    expect(settled.currency).toBe('NGN');
    expect(settled.withinTolerance).toBe(true);
  });

  it('scales the sibling price row by seats', () => {
    const settled = resolveSettledAmount({
      paidAmount: 450000,
      paidCurrency: 'ngn',
      planPrice: usdPlan,
      planPriceInPaidCurrency: ngnRow,
      seatCount: 3,
    });

    expect(settled.expectedAmount).toBe(450000);
    expect(settled.withinTolerance).toBe(true);
  });

  it('rejects an NGN payment that underpays the NGN price row', () => {
    const settled = resolveSettledAmount({
      paidAmount: 1000,
      paidCurrency: 'NGN',
      planPrice: usdPlan,
      planPriceInPaidCurrency: ngnRow,
      seatCount: 1,
    });

    expect(settled.withinTolerance).toBe(false);
  });

  it('accepts an adaptive-converted currency we do not price', () => {
    const settled = resolveSettledAmount({
      paidAmount: 1450,
      paidCurrency: 'GHS',
      planPrice: usdPlan,
      planPriceInPaidCurrency: null,
      seatCount: 1,
    });

    expect(settled.basis).toBe('provider_reported');
    expect(settled.expectedAmount).toBeNull();
    expect(settled.amount).toBe(1450);
    expect(settled.currency).toBe('GHS');
    expect(settled.withinTolerance).toBe(true);
  });

  it('rejects a zero or absurdly small converted figure', () => {
    expect(
      resolveSettledAmount({
        paidAmount: 0,
        paidCurrency: 'GHS',
        planPrice: usdPlan,
        planPriceInPaidCurrency: null,
        seatCount: 1,
      }).withinTolerance,
    ).toBe(false);

    expect(
      resolveSettledAmount({
        paidAmount: 0.5,
        paidCurrency: 'GHS',
        planPrice: usdPlan,
        planPriceInPaidCurrency: null,
        seatCount: 1,
      }).withinTolerance,
    ).toBe(false);
  });

  it('falls back to the plan currency when the webhook omits one', () => {
    const settled = resolveSettledAmount({
      paidAmount: 99,
      paidCurrency: undefined,
      planPrice: usdPlan,
      planPriceInPaidCurrency: null,
      seatCount: 1,
    });

    expect(settled.currency).toBe('USD');
    expect(settled.basis).toBe('plan_currency');
    expect(settled.withinTolerance).toBe(true);
  });
});
