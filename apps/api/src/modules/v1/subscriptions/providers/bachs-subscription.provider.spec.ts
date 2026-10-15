import { BachsApiService } from 'src/common/services/bachs-api.service';
import { BillingChargeType } from '../constants/billing.constants';
import { BachsSubscriptionProvider } from './bachs-subscription.provider';

describe('BachsSubscriptionProvider.createCheckout', () => {
  it('omits billing_currency so Bachs hosted checkout can switch currency', async () => {
    const createCheckoutSession = jest.fn().mockResolvedValue({
      checkout_id: 'chk_1',
      checkout_url: 'https://checkout.bachs.io/chk_1',
      reference: 'ref_1',
    });
    const provider = new BachsSubscriptionProvider({
      createCheckoutSession,
    } as unknown as BachsApiService);

    const planPrice = {
      currency: 'USD',
      bachsProductId: 'prod_usd_1',
      plan: { slug: 'scale', name: 'Scale' },
      calculateMonthlyPrice: () => ({ totalPrice: 99 }),
    } as never;

    await provider.createCheckout(
      'user@example.com',
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        planId: 'plan-1',
        planPriceId: 'price-1',
      },
      planPrice,
      'https://app.example.com/ws/billing?billing=success',
      2,
    );

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod_usd_1',
        quantity: 2,
        metadata: expect.objectContaining({
          billingCurrency: 'USD',
        }),
      }),
    );
    expect(createCheckoutSession.mock.calls[0][0]).not.toHaveProperty('billingCurrency');
  });
});

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
        next_billed_at: '2026-09-01T00:00:00.000Z',
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
      expect(event.payment.nextBillingDate).toBe('2026-09-01T00:00:00.000Z');
    }
  });

  it('parses cycle invoice without tenant metadata when subscription_id is present', () => {
    const event = provider.parseWebhook({
      id: 'evt_cycle_no_meta',
      type: 'invoice.paid',
      data: {
        invoice_id: 'inv_cycle',
        amount_paid: '49.00',
        currency: 'USD',
        subscription_id: 'sub_remote_1',
        next_billed_at: '2026-10-01T00:00:00.000Z',
        metadata: {},
      },
    });

    expect(event?.kind).toBe('payment.success');
    if (event?.kind === 'payment.success') {
      expect(event.payment.tenantId).toBe('');
      expect(event.payment.externalSubscriptionId).toBe('sub_remote_1');
      expect(event.payment.reference).toBe('inv_cycle');
      expect(event.payment.nextBillingDate).toBe('2026-10-01T00:00:00.000Z');
    }
  });

  it('returns null when cycle invoice has neither tenantId nor subscription_id', () => {
    const event = provider.parseWebhook({
      id: 'evt_orphan',
      type: 'invoice.paid',
      data: {
        invoice_id: 'inv_orphan',
        amount_paid: '49.00',
        currency: 'USD',
        metadata: {},
      },
    });

    expect(event).toBeNull();
  });

  it('parses subscription.created with plan metadata for Scale trial', () => {
    const event = provider.parseWebhook({
      id: 'evt_sub_1',
      type: 'customer.subscription.created',
      data: {
        subscription_id: 'sub_177419ea76a54cf393d0',
        status: 'trialing',
        trial_end: '2026-08-05T20:19:22.859227+00:00',
        current_period_start: '2026-07-22T20:19:22.889407+00:00',
        current_period_end: '2026-08-05T20:19:22.859227+00:00',
        next_billed_at: '2026-08-05T20:19:22.859227+00:00',
        metadata: {
          tenantId: 'c3de206d-ed4d-4cc8-94e7-ea2ea6111111',
          planId: '355863ce-fb5a-4da6-8c29-842c47111111',
          planPriceId: '93de2189-cb69-4988-b253-df1330111111',
          quantity: 3,
          billingType: 'subscription',
          planSlug: 'scale',
        },
      },
    });

    expect(event?.kind).toBe('subscription.created');
    if (event?.kind === 'subscription.created') {
      expect(event.planId).toBe('355863ce-fb5a-4da6-8c29-842c47111111');
      expect(event.planPriceId).toBe('93de2189-cb69-4988-b253-df1330111111');
      expect(event.quantity).toBe(3);
      expect(event.providerStatus).toBe('trialing');
      expect(event.externalSubscriptionId).toBe('sub_177419ea76a54cf393d0');
    }
  });
});
