import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BillingOverviewService } from './billing-overview.service';
import { buildProviderDoubles, buildRepositoryDoubles, TENANT_ID } from './billing-test-doubles';

/** Billing overview assembly lives in BillingOverviewService; the facade only delegates. */
function createOverviewService() {
  const providers = buildProviderDoubles();
  const repos = buildRepositoryDoubles();

  const subscriptionsService = {
    getBillingStatus: jest.fn(),
    getTenantSubscription: jest.fn(),
    healNgSubscriptionPlanPrice: jest.fn(async (_country: string, subscription: unknown) => ({
      subscription,
      pricingMismatch: null,
    })),
    computeNeedsPayment: jest.fn().mockReturnValue(false),
    isTrialEligible: jest.fn().mockResolvedValue(false),
  };
  const tenantSettingsService = {
    getTenantSettings: jest.fn().mockResolvedValue({
      settings: { billing: { contactEmail: 'billing@example.com' } },
    }),
  };
  const plansService = { getPricesForCountry: jest.fn().mockResolvedValue([]) };
  const seatPricing = { getTenantSeatCount: jest.fn().mockResolvedValue(1) };

  const service = new BillingOverviewService(
    providers.billingProviderFactory as never,
    subscriptionsService as never,
    tenantSettingsService as never,
    plansService as never,
    repos.tenantRepo as never,
    seatPricing as never,
  );

  return {
    service,
    providers,
    repos,
    subscriptionsService,
    tenantSettingsService,
    plansService,
  };
}

const tenant = {
  id: TENANT_ID,
  name: 'Acme',
  countryCode: 'US',
  preferredCurrency: 'USD',
  createdBy: { email: 'owner@example.com' },
};

const billingStatus = {
  paymentsEnabled: true,
  entitled: true,
  needsPayment: false,
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    plan: 'scale',
    trialEndsAt: null,
    isOnTrial: false,
    daysRemaining: null,
    currentPeriodEnd: new Date(),
  },
};

describe('BillingOverviewService privacy', () => {
  afterEach(() => jest.restoreAllMocks());

  it('hides ownerEmail and billingContact from non-managers', async () => {
    const { service, repos, subscriptionsService } = createOverviewService();
    repos.tenantRepo.findOne.mockResolvedValue(tenant);
    subscriptionsService.getBillingStatus.mockResolvedValue(billingStatus);
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      nextBillingDate: new Date(),
      billingHistory: [],
      billingProvider: BillingProvider.BACHS,
    });
    repos.tenantMemberRepo.count.mockResolvedValue(1);

    const overview = await service.getBillingOverview(TENANT_ID, false);

    expect(overview.ownerEmail).toBeNull();
    expect(overview.billingContact).toEqual({});
  });

  it('exposes billing contact to managers', async () => {
    const { service, repos, subscriptionsService } = createOverviewService();
    repos.tenantRepo.findOne.mockResolvedValue(tenant);
    subscriptionsService.getBillingStatus.mockResolvedValue(billingStatus);
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      nextBillingDate: new Date(),
      billingHistory: [],
      billingProvider: BillingProvider.BACHS,
    });
    repos.tenantMemberRepo.count.mockResolvedValue(1);

    const overview = await service.getBillingOverview(TENANT_ID, true);

    expect(overview.ownerEmail).toBe('owner@example.com');
    expect(overview.billingContact).toEqual(
      expect.objectContaining({ contactEmail: 'billing@example.com' }),
    );
  });
});

describe('BillingOverviewService provider reads', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads a paid Bachs subscription from the DB without calling the provider', async () => {
    const { service, repos, subscriptionsService, providers } = createOverviewService();
    const getSubscription = jest.fn();
    (providers.bachsProvider as { getSubscription?: jest.Mock }).getSubscription = getSubscription;

    repos.tenantRepo.findOne.mockResolvedValue(tenant);
    subscriptionsService.getBillingStatus.mockResolvedValue(billingStatus);
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_38ffe427df864bcdae4b',
      nextBillingDate: new Date('2026-09-12T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-12T00:00:00.000Z'),
      billingHistory: [{ date: new Date(), amount: 49, currency: 'USD', status: 'paid' as const }],
    });
    repos.tenantMemberRepo.count.mockResolvedValue(1);

    await service.getBillingOverview(TENANT_ID, true);

    expect(getSubscription).not.toHaveBeenCalled();
  });
});
