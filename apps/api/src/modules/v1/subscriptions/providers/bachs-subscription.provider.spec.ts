import { BachsApiService } from 'src/common/services/bachs-api.service';
import { BillingChargeType } from '../constants/billing.constants';
import { BachsSubscriptionProvider } from './bachs-subscription.provider';

describe('BachsSubscriptionProvider.parseWebhook', () => {
  const provider = new BachsSubscriptionProvider({} as BachsApiService);

  it('treats invoice.paid as initial subscription payment using amount_paid', () => {
    const event = provider.parseWebhook({
      id: 'evt_1',
      type: 'invoice.paid',
      data: {
        invoice_id: 'inv_1',
        amount_paid: '99.00',
        total: '99.00',
        currency: 'USD',
        subscription: { subscription_id: 'sub_1' },
        metadata: {
          tenantId: '11111111-1111-1111-1111-111111111111',
          planId: 'plan_1',
          planPriceId: 'price_1',
          billingType: BillingChargeType.SUBSCRIPTION,
        },
      },
    });

    expect(event?.kind).toBe('payment.success');
    if (event?.kind === 'payment.success') {
      expect(event.payment.amount).toBe(99);
      expect(event.payment.billingType).toBe(BillingChargeType.SUBSCRIPTION);
      expect(event.payment.externalSubscriptionId).toBe('sub_1');
      expect(event.payment.reference).toBe('inv_1');
    }
  });
});
