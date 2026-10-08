import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';

/**
 * Provider doubles for subscription billing specs.
 *
 * SubscriptionBillingService was split into RenewalProcessor, WebhookDispatcher,
 * PaymentSuccessHandlers, SubscriptionCheckoutService, BillingOverviewService and
 * SeatPricingCalculator. Each spec builds the collaborator it owns out of these shared
 * doubles so the provider/factory stubs stay identical across the suite.
 */

export const TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const USER_ID = '22222222-2222-4222-8222-222222222222';

export function buildProviderDoubles() {
  const nombaProvider = {
    ensureConfigured: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhook: jest.fn(),
    createCheckout: jest.fn().mockResolvedValue({
      id: 'chk_1',
      checkoutUrl: 'https://checkout.example',
      reference: 'ref_1',
    }),
    createCardUpdateCheckout: jest.fn(),
    chargeSeatAddition: jest.fn().mockResolvedValue({ orderReference: 'sub_qty_1' }),
    chargeRenewal: jest.fn().mockResolvedValue({ orderReference: 'sub_ren_mock' }),
    cancelExternalSubscription: jest.fn(),
  };

  const mapStatus = jest.fn((status: string) =>
    status === 'active' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.INACTIVE,
  );
  const bachsProvider = { parseWebhook: jest.fn(), mapStatus, createCheckout: jest.fn() };
  const polarProvider = { parseWebhook: jest.fn(), mapStatus };
  const monnifyProvider = { parseWebhook: jest.fn(), mapStatus };

  const billingProviderFactory = {
    getNombaProvider: () => nombaProvider,
    getProviderByEnum: jest.fn((provider: BillingProvider) => {
      if (provider === BillingProvider.BACHS) return bachsProvider;
      if (provider === BillingProvider.POLAR) return polarProvider;
      if (provider === BillingProvider.MONNIFY) return monnifyProvider;
      return nombaProvider;
    }),
    getProviderForCountry: jest.fn(() => nombaProvider),
    resolveBillingProvider: jest.fn(() => BillingProvider.NOMBA),
    ensureConfigured: jest.fn(),
    cancelExternalSubscription: jest.fn().mockResolvedValue(undefined),
    resumeExternalSubscription: jest.fn().mockResolvedValue(undefined),
    endExternalTrial: jest.fn().mockResolvedValue(undefined),
  };

  return {
    nombaProvider,
    bachsProvider,
    polarProvider,
    monnifyProvider,
    billingProviderFactory,
  };
}

export function buildRepositoryDoubles() {
  const billingEventRepo = {
    exists: jest.fn().mockResolvedValue(false),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    create: jest.fn((x) => x),
    hasProcessedEvent: jest.fn().mockResolvedValue(false),
    record: jest.fn(),
  };

  const subscriptionRepo = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(async (s) => s),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const tenantRepo = { findOne: jest.fn(), save: jest.fn(async (t) => t) };
  const userRepo = { findOne: jest.fn() };
  const tenantMemberRepo = { count: jest.fn(), findOne: jest.fn() };

  return { billingEventRepo, subscriptionRepo, tenantRepo, userRepo, tenantMemberRepo };
}

export function buildPlanPrice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'price-1',
    planId: 'plan-1',
    isActive: true,
    currency: 'NGN',
    monthlyPrice: 100,
    calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    ...overrides,
  };
}

/** Active subscription already carrying one paid period, as the managed rails report it. */
export function paidSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    tenantId: TENANT_ID,
    status: SubscriptionStatus.ACTIVE,
    planId: 'plan-1',
    planPriceId: 'price-1',
    billingProvider: BillingProvider.BACHS,
    externalSubscriptionId: 'sub_ext_1',
    nextBillingDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    billingHistory: [{ date: new Date(), amount: 100, currency: 'USD', status: 'paid' }],
    currentUsers: 1,
    ...overrides,
  };
}
