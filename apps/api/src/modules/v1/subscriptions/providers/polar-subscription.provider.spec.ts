import { BillingChargeType } from '../constants/billing.constants';
import { PolarSubscriptionProvider } from './polar-subscription.provider';

describe('PolarSubscriptionProvider.parseWebhook', () => {
  const provider = new PolarSubscriptionProvider();

  it('reads total_amount (cents) for order.paid', () => {
    const event = provider.parseWebhook({
      type: 'order.paid',
      data: {
        id: 'ord_1',
        status: 'paid',
        total_amount: 9900,
        currency: 'usd',
        metadata: {
          tenantId: '11111111-1111-1111-1111-111111111111',
          planId: 'plan_1',
          planPriceId: 'price_1',
        },
      },
    });

    expect(event?.kind).toBe('payment.success');
    if (event?.kind === 'payment.success') {
      expect(event.payment.amount).toBe(99);
    }
  });

  it('parses cycle order.paid without tenantId when subscription_id is present', () => {
    const event = provider.parseWebhook({
      type: 'order.paid',
      data: {
        id: 'ord_cycle',
        status: 'paid',
        billing_reason: 'subscription_cycle',
        total_amount: 9900,
        currency: 'usd',
        subscription_id: 'pol_sub_1',
        subscription: {
          id: 'pol_sub_1',
          current_period_start: '2026-08-01T00:00:00.000Z',
          current_period_end: '2026-09-01T00:00:00.000Z',
        },
        metadata: {},
      },
    });

    expect(event?.kind).toBe('payment.success');
    if (event?.kind === 'payment.success') {
      expect(event.payment.tenantId).toBe('');
      expect(event.payment.externalSubscriptionId).toBe('pol_sub_1');
      expect(event.payment.billingType).toBe(BillingChargeType.SUBSCRIPTION_RENEWAL);
      expect(event.payment.currentPeriodStart).toBe('2026-08-01T00:00:00.000Z');
      expect(event.payment.currentPeriodEnd).toBe('2026-09-01T00:00:00.000Z');
      expect(event.payment.nextBillingDate).toBe('2026-09-01T00:00:00.000Z');
    }
  });

  it('parses subscription.cancelled with externalSubscriptionId only', () => {
    const event = provider.parseWebhook({
      type: 'subscription.canceled',
      data: {
        id: 'pol_sub_cancel',
        subscription_id: 'pol_sub_cancel',
        metadata: {},
      },
    });

    expect(event?.kind).toBe('subscription.cancelled');
    if (event?.kind === 'subscription.cancelled') {
      expect(event.tenantId).toBe('');
      expect(event.externalSubscriptionId).toBe('pol_sub_cancel');
    }
  });
});
