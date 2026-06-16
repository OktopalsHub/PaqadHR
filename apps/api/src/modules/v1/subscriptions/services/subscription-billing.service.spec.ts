import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { SubscriptionBillingService } from './subscription-billing.service';

describe('SubscriptionBillingService renewal jobs', () => {
  const originalBillingMode = process.env.BILLING_MODE;
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_ACCOUNT_ID;

  const createService = () => {
    const nombaProvider = { ensureConfigured: jest.fn() };
    const nombaApi = { verifyTransaction: jest.fn() };
    const subscriptionsService = { getBillingStatus: jest.fn(), getTenantSubscription: jest.fn() };
    const plansService = { getPlanPriceById: jest.fn() };
    const subscriptionRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    const tenantRepo = { findOne: jest.fn() };
    const userRepo = { findOne: jest.fn() };
    const tenantMemberRepo = { count: jest.fn(), findOne: jest.fn() };
    const billingEventRepo = { exists: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    const dataSource = { transaction: jest.fn() };

    const service = new SubscriptionBillingService(
      nombaProvider as never,
      nombaApi as never,
      subscriptionsService as never,
      plansService as never,
      subscriptionRepo as never,
      tenantRepo as never,
      userRepo as never,
      tenantMemberRepo as never,
      billingEventRepo as never,
      dataSource as never,
    );

    return {
      service,
      nombaProvider,
      subscriptionRepo,
    };
  };

  afterEach(() => {
    process.env.BILLING_MODE = originalBillingMode;
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('returns empty result when billing gateway is disabled', async () => {
    process.env.BILLING_MODE = 'trial';
    const { service, nombaProvider } = createService();

    const result = await service.processDueRenewals();

    expect(result).toEqual({ charged: 0, failed: 0, skipped: 0, suspended: 0 });
    expect(nombaProvider.ensureConfigured).not.toHaveBeenCalled();
  });

  it('aggregates outcomes across due renewals', async () => {
    process.env.BILLING_MODE = 'open';
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_ACCOUNT_ID = 'account-id';
    const { service, subscriptionRepo, nombaProvider } = createService();
    const dueSubs = [
      { id: 'sub-1' },
      { id: 'sub-2' },
      { id: 'sub-3' },
    ];

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(dueSubs),
    };
    subscriptionRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    jest.spyOn(service as any, 'suspendPastGraceSubscriptions').mockResolvedValue(2);
    const chargeSpy = jest
      .spyOn(service as any, 'chargeSubscriptionRenewal')
      .mockResolvedValueOnce('charged')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('skipped');

    const result = await service.processDueRenewals();

    expect(nombaProvider.ensureConfigured).toHaveBeenCalledTimes(1);
    expect(chargeSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ charged: 1, failed: 1, skipped: 1, suspended: 2 });
  });

  it('skips renewal charge when renewal attempt was already processed', async () => {
    process.env.BILLING_MODE = 'open';
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_ACCOUNT_ID = 'account-id';
    const { service } = createService();
    const nextBillingDate = new Date('2026-06-01T00:00:00.000Z');
    const subscription = {
      id: 'sub-idempotent',
      nextBillingDate,
      tenantId: 'tenant-1',
      planPriceId: 'price-1',
      planId: 'plan-1',
      paymentMethodId: 'tok_123',
      nombaSubscriptionId: 'nomba_ref_1',
      status: SubscriptionStatus.ACTIVE,
    };

    jest.spyOn(service as any, 'hasProcessedEvent').mockResolvedValue(true);

    const outcome = await (service as any).chargeSubscriptionRenewal(subscription);

    expect(outcome).toBe('skipped');
  });
});
