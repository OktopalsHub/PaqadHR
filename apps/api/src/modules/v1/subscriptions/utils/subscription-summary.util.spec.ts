import type { TenantSubscription } from '../entities/tenant-subscription.entity';
import { toSubscriptionSummary } from './subscription-summary.util';

const secretEntity = {
  id: 'sub-1',
  tenantId: 't-1',
  planId: 'plan-1',
  planPriceId: 'price-1',
  status: 'active',
  currentUsers: 4,
  trialEndsAt: null,
  currentPeriodStart: new Date('2026-01-01'),
  currentPeriodEnd: new Date('2026-02-01'),
  nextBillingDate: new Date('2026-02-01'),
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  paymentMethodBrand: 'visa',
  paymentMethodLastFour: '4242',
  nombaSubscriptionId: 'nomba-secret',
  externalSubscriptionId: 'ext-secret',
  noahCustomerId: 'noah-secret',
  paymentMethodId: 'pm-secret',
  lastPaymentFailureDetail: 'raw provider detail',
  usageMetrics: { monnifyWalletCardToken: 'card-token-secret', bachsPaymentMethodId: 'bachs-secret' },
  billingHistory: [{ invoiceId: 'inv-secret' }],
  tenant: { id: 't-1', name: 'Acme', billingEmail: 'owner@acme.test' },
  plan: { id: 'plan-1', slug: 'pro', name: 'Pro', features: { a: true }, limits: { users: 10 }, internal: 'x' },
  planPrice: {
    id: 'price-1',
    currency: 'USD',
    monthlyPrice: 10,
    yearlyPrice: 100,
    nombaPlanId: 'nomba-plan-secret',
    bachsProductId: 'bachs-product-secret',
  },
} as unknown as TenantSubscription;

describe('toSubscriptionSummary', () => {
  it('returns null for a tenant without a subscription', () => {
    expect(toSubscriptionSummary(null)).toBeNull();
  });

  it('keeps the billing state a member needs', () => {
    expect(toSubscriptionSummary(secretEntity)).toMatchObject({
      id: 'sub-1',
      status: 'active',
      paymentMethodBrand: 'visa',
      paymentMethodLastFour: '4242',
      plan: { slug: 'pro', name: 'Pro', features: { a: true }, limits: { users: 10 } },
      planPrice: { currency: 'USD', monthlyPrice: 10, yearlyPrice: 100 },
    });
  });

  it('never serialises tokens, provider ids, failure detail, history or the tenant', () => {
    const json = JSON.stringify(toSubscriptionSummary(secretEntity));
    for (const secret of [
      'secret',
      'nomba',
      'bachs',
      'noah',
      'monnify',
      'raw provider detail',
      'owner@acme.test',
      'usageMetrics',
      'billingHistory',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});
