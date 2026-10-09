import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';
import {
  buildProviderDoubles,
  buildRepositoryDoubles,
  TENANT_ID,
  USER_ID,
} from './billing-test-doubles';
import { SubscriptionCheckoutService } from './subscription-checkout.service';

/** Checkout guards live in SubscriptionCheckoutService; the facade only delegates. */
function createCheckoutService() {
  const providers = buildProviderDoubles();
  const repos = buildRepositoryDoubles();

  const subscriptionsService = {
    getTenantSubscription: jest.fn(),
    resolveAndLockTenantRegion: jest.fn().mockResolvedValue({
      id: TENANT_ID,
      countryCode: 'NG',
      preferredCurrency: 'NGN',
      pricingLocked: true,
    }),
    healNgSubscriptionPlanPrice: jest.fn(async (_c: string, subscription: unknown) => ({
      subscription,
      pricingMismatch: null,
    })),
    computeNeedsPayment: jest.fn().mockReturnValue(false),
    isTrialEligible: jest.fn().mockResolvedValue(true),
  };
  const plansService = {
    findPlanBySlug: jest.fn().mockResolvedValue({ slug: 'scale', isActive: true }),
    getPlanPrice: jest.fn().mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      currency: 'USD',
      isActive: true,
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    }),
  };
  const seatPricing = { getTenantSeatCount: jest.fn().mockResolvedValue(1) };

  repos.tenantRepo.findOne.mockResolvedValue({
    id: TENANT_ID,
    slug: 'acme',
    countryCode: 'NG',
    preferredCurrency: 'NGN',
  });
  repos.userRepo.findOne.mockResolvedValue({ id: USER_ID, email: 'owner@example.com' });
  repos.tenantMemberRepo.count.mockResolvedValue(1);
  repos.tenantMemberRepo.findOne.mockResolvedValue({ id: 'member-1' });
  providers.billingProviderFactory.resolveBillingProvider.mockReturnValue(BillingProvider.BACHS);
  providers.billingProviderFactory.getProviderForCountry.mockReturnValue(
    providers.bachsProvider as never,
  );
  (providers.bachsProvider as { createCheckout: jest.Mock }).createCheckout.mockResolvedValue({
    id: 'chk_1',
    checkoutUrl: 'https://checkout.example',
    reference: 'ref_1',
  });

  const service = new SubscriptionCheckoutService(
    providers.billingProviderFactory as never,
    subscriptionsService as never,
    plansService as never,
    repos.tenantRepo as never,
    repos.userRepo as never,
    repos.tenantMemberRepo as never,
    seatPricing as never,
  );

  return { service, providers, repos, subscriptionsService };
}

describe('SubscriptionCheckoutService guards', () => {
  beforeEach(() => {
    process.env.BACHS_SECRET_KEY = 'bachs-secret';
  });

  afterEach(() => {
    delete process.env.BACHS_SECRET_KEY;
    jest.restoreAllMocks();
  });

  it('allows a TRIAL subscription to check out the same plan again', async () => {
    const { service, providers, subscriptionsService } = createCheckoutService();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.TRIAL,
      plan: { slug: 'scale' },
      billingProvider: BillingProvider.BACHS,
    });

    const result = await service.createSubscriptionCheckout(TENANT_ID, 'scale', USER_ID);

    expect(result.reference).toBe('ref_1');
    expect(
      (providers.bachsProvider as { createCheckout: jest.Mock }).createCheckout,
    ).toHaveBeenCalled();
  });

  it('blocks checkout when the workspace already has an active subscription', async () => {
    const { service, subscriptionsService } = createCheckoutService();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      plan: { slug: 'scale' },
      billingProvider: BillingProvider.BACHS,
      nextBillingDate: new Date(Date.now() + 86_400_000),
    });

    await expect(service.createSubscriptionCheckout(TENANT_ID, 'scale', USER_ID)).rejects.toThrow(
      'Already has active subscription on this plan',
    );
  });

  it('blocks checkout while a provider subscription is still past due', async () => {
    const { service, subscriptionsService } = createCheckoutService();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.PAST_DUE,
      plan: { slug: 'starter' },
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_bachs_past_due',
      paymentMethodId: 'sub_bachs_past_due',
    });

    await expect(service.createSubscriptionCheckout(TENANT_ID, 'scale', USER_ID)).rejects.toThrow(
      'Past due with active provider subscription.',
    );
  });
});
