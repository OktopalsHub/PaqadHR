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
});
