import { BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';

import { BillingProvider } from '../constants/billing-provider.enum';
import { RenewalSuccessApplicator } from './renewal-success-applicator';

const planPrice = {
  id: 'pp',
  planId: 'p',
  currency: 'USD',
  isActive: true,
  monthlyPrice: 10,
  calculateMonthlyPrice: (seats: number) => ({ totalPrice: 10 * seats }),
};

function build() {
  const subscription = {
    tenantId: 't',
    status: SubscriptionStatus.ACTIVE,
    billingProvider: BillingProvider.NOMBA,
    planPriceId: 'pp',
    currentUsers: 1,
  };
  const transaction = jest.fn();
  const applicator = new RenewalSuccessApplicator(
    { findOne: jest.fn().mockResolvedValue(subscription) } as never,
    { getPlanPriceById: jest.fn().mockResolvedValue(planPrice) } as never,
    { getTenantSeatCount: jest.fn().mockResolvedValue(1) } as never,
    { transaction } as never,
    {} as never,
    {} as never,
  );
  return { applicator, transaction };
}

describe('RenewalSuccessApplicator', () => {
  const payment = (amount: number) =>
    ({ eventId: 'e', reference: 'r', tenantId: 't', amount, currency: 'USD', quantity: 1 }) as never;

  it('rejects a renewal whose settled amount does not match the price', async () => {
    const { applicator, transaction } = build();
    await expect(
      applicator.applyRenewalSuccess('t', payment(0), BillingProvider.NOMBA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('extends the period when the amount matches', async () => {
    const { applicator, transaction } = build();
    await applicator.applyRenewalSuccess('t', payment(10), BillingProvider.NOMBA);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
