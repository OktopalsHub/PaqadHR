import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';
import { buildProviderDoubles, buildRepositoryDoubles } from './billing-test-doubles';
import { SeatPricingCalculator } from './seat-pricing-calculator';

/** Seat sync and seat pricing live in SeatPricingCalculator; the facade only delegates. */
function createCalculator() {
  const providers = buildProviderDoubles();
  const repos = buildRepositoryDoubles();

  const planPrice = {
    id: 'price-1',
    planId: 'plan-1',
    currency: 'NGN',
    monthlyPrice: 3500,
    regionalConfig: { pricePerUser: 3500, minimumUsers: 1, includedUsers: 50 },
    config: { pricePerUser: 3500, minimumUsers: 1, includedUsers: 50 },
    calculateMonthlyPrice(userCount: number) {
      return {
        basePrice: userCount * 3500,
        overagePrice: 0,
        totalPrice: userCount * 3500,
        overageUsers: 0,
      };
    },
  };

  const plansService = { getPlanPriceById: jest.fn().mockResolvedValue(planPrice) };
  const tenantSettingsService = { getTenantSettings: jest.fn() };

  const calculator = new SeatPricingCalculator(
    repos.subscriptionRepo as never,
    repos.tenantMemberRepo as never,
    plansService as never,
    tenantSettingsService as never,
    providers.billingProviderFactory as never,
  );

  return { calculator, providers, repos, planPrice };
}

const baseSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  tenantId: 'tenant-1',
  planId: 'plan-1',
  planPriceId: 'price-1',
  status: SubscriptionStatus.ACTIVE,
  billingProvider: BillingProvider.NOMBA,
  nombaSubscriptionId: 'nomba_ref_1',
  paymentMethodId: 'tok_123',
  currentUsers: 10,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
  usageMetrics: {},
  tenant: { createdBy: { email: 'billing@example.com' } },
  ...overrides,
});

describe('SeatPricingCalculator.syncSubscriptionQuantity', () => {
  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does nothing when live seats equal billed seats', async () => {
    const { calculator, providers, repos } = createCalculator();
    repos.subscriptionRepo.findOne.mockResolvedValue(baseSubscription());
    repos.tenantMemberRepo.count.mockResolvedValue(10);

    await calculator.syncSubscriptionQuantity('tenant-1');

    expect(providers.nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('lowers currentUsers without charging when seats decrease', async () => {
    const { calculator, providers, repos } = createCalculator();
    repos.subscriptionRepo.findOne.mockResolvedValue(baseSubscription({ currentUsers: 11 }));
    repos.tenantMemberRepo.count.mockResolvedValue(10);

    await calculator.syncSubscriptionQuantity('tenant-1');

    expect(providers.nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(repos.subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentUsers: 10 }),
    );
  });

  it('charges the prorated amount and holds a pending seat count when seats increase', async () => {
    const { calculator, providers, repos } = createCalculator();
    repos.subscriptionRepo.findOne.mockResolvedValue(baseSubscription());
    repos.tenantMemberRepo.count.mockResolvedValue(11);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-16T00:00:00.000Z'));

    await calculator.syncSubscriptionQuantity('tenant-1');

    expect(providers.nombaProvider.chargeSeatAddition).toHaveBeenCalledWith(
      'nomba_ref_1',
      expect.anything(),
      expect.any(Number),
      11,
      expect.any(Number),
      'tok_123',
      'billing@example.com',
      expect.anything(),
    );
    expect(repos.subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.objectContaining({ pendingSeatCount: 11 }),
      }),
    );
  });

  it('skips managed subscriptions that have no Nomba subscription or payment method', async () => {
    const { calculator, providers, repos } = createCalculator();
    repos.subscriptionRepo.findOne.mockResolvedValue(
      baseSubscription({ nombaSubscriptionId: null, currentUsers: 11 }),
    );
    repos.tenantMemberRepo.count.mockResolvedValue(11);

    await calculator.syncSubscriptionQuantity('tenant-1');

    expect(providers.nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
  });
});

describe('SeatPricingCalculator.getTenantSeatCount', () => {
  it('returns the live tenant member count', async () => {
    const { calculator, repos } = createCalculator();
    repos.tenantMemberRepo.count.mockResolvedValue(7);

    await expect(calculator.getTenantSeatCount('tenant-1')).resolves.toBe(7);
  });
});
