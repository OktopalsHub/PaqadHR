import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';
import { SubscriptionBillingService } from './subscription-billing.service';

function buildSubscriptionBillingService(nombaProviderOverrides: Record<string, unknown> = {}) {
  const nombaProvider = {
    ensureConfigured: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhook: jest.fn(),
    createCardUpdateCheckout: jest.fn(),
    chargeSeatAddition: jest.fn().mockResolvedValue({ orderReference: 'sub_qty_1' }),
    ...nombaProviderOverrides,
  };
  const bachsProvider = {
    parseWebhook: jest.fn(),
  };
  const polarProvider = {
    parseWebhook: jest.fn(),
  };
  const billingProviderFactory = {
    getNombaProvider: () => nombaProvider,
    getProviderByEnum: jest.fn((provider: BillingProvider) => {
      if (provider === BillingProvider.BACHS) return bachsProvider;
      if (provider === BillingProvider.POLAR) return polarProvider;
      return nombaProvider;
    }),
    resolveBillingProvider: jest.fn(() => BillingProvider.NOMBA),
    ensureConfigured: jest.fn(),
    cancelExternalSubscription: jest.fn().mockResolvedValue(undefined),
  };
  const nombaApi = { verifyTransaction: jest.fn() };
  const subscriptionsService = { getBillingStatus: jest.fn(), getTenantSubscription: jest.fn() };
  const tenantSettingsService = { getTenantSettings: jest.fn() };
  const plansService = { getPlanPriceById: jest.fn() };
  const subscriptionRepo = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(async (s) => s),
    findOne: jest.fn(),
  };
  const tenantRepo = { findOne: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const tenantMemberRepo = { count: jest.fn(), findOne: jest.fn() };
  const billingEventRepo = {
    exists: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };
  const dataSource = { transaction: jest.fn() };

  const service = new SubscriptionBillingService(
    billingProviderFactory as never,
    nombaApi as never,
    subscriptionsService as never,
    tenantSettingsService as never,
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
    bachsProvider,
    polarProvider,
    billingProviderFactory,
    subscriptionsService,
    subscriptionRepo,
    billingEventRepo,
    tenantMemberRepo,
    tenantSettingsService,
    plansService,
    nombaApi,
  };
}

describe('SubscriptionBillingService renewal jobs', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;

  const createService = () => buildSubscriptionBillingService();

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('returns empty result when billing gateway is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.BACHS_SECRET_KEY;
    delete process.env.POLAR_ACCESS_TOKEN;
    const { service, billingProviderFactory } = createService();

    const result = await service.processDueRenewals();

    expect(result).toEqual({ charged: 0, failed: 0, skipped: 0, suspended: 0 });
    expect(billingProviderFactory.ensureConfigured).not.toHaveBeenCalled();
  });

  it('aggregates outcomes across due renewals', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
    const { service, subscriptionRepo } = createService();
    const dueSubs = [{ id: 'sub-1' }, { id: 'sub-2' }, { id: 'sub-3' }];

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(dueSubs),
    };
    subscriptionRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    jest.spyOn(service as any, 'suspendPastGraceSubscriptions').mockResolvedValue(2);
    jest.spyOn(service as any, 'finalizeScheduledCancellations').mockResolvedValue(undefined);
    const chargeSpy = jest
      .spyOn(service as any, 'chargeSubscriptionRenewal')
      .mockResolvedValueOnce('charged')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('skipped');

    const result = await service.processDueRenewals();

    expect(chargeSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ charged: 1, failed: 1, skipped: 1, suspended: 2 });
  });

  it('skips renewal charge when renewal attempt was already processed', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
    const { service } = createService();
    const subscription = {
      id: 'sub-idempotent',
      nextBillingDate: new Date('2026-06-01T00:00:00.000Z'),
      tenantId: 'tenant-1',
      planPriceId: 'price-1',
      planId: 'plan-1',
      paymentMethodId: 'tok_123',
      nombaSubscriptionId: 'nomba_ref_1',
      status: SubscriptionStatus.ACTIVE,
      dunningAttemptCount: 0,
    };

    jest.spyOn(service as any, 'hasProcessedEvent').mockResolvedValue(true);

    const outcome = await (service as any).chargeSubscriptionRenewal(subscription);

    expect(outcome).toBe('skipped');
  });
});

describe('SubscriptionBillingService webhooks', () => {
  const createService = () => buildSubscriptionBillingService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects missing webhook signatures', async () => {
    const { service } = createService();
    await expect(service.handleNombaWebhook('{}', '')).rejects.toThrow('Missing webhook signature');
  });

  it('rejects invalid webhook signatures', async () => {
    const { service, nombaProvider } = createService();
    (nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(false);
    await expect(service.handleNombaWebhook('{}', 'bad')).rejects.toThrow(
      'Invalid webhook signature',
    );
  });

  it('routes payment.success to initial payment handler', async () => {
    const { service, nombaProvider } = createService();
    (nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: { eventId: 'evt-1', reference: 'ref-1', tenantId: 'tenant-1' },
    });
    const spy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.handleNombaWebhook('{}', 'sig');

    expect(spy).toHaveBeenCalled();
  });

  it('routes payment.failed to failure handler', async () => {
    const { service, nombaProvider } = createService();
    (nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.failed',
      payment: { eventId: 'evt-fail', reference: 'ref-fail', tenantId: 'tenant-1' },
    });
    const spy = jest.spyOn(service as any, 'processPaymentFailed').mockResolvedValue(undefined);

    await service.handleNombaWebhook('{}', 'sig');

    expect(spy).toHaveBeenCalled();
  });

  it('records Bachs failure events under the Bachs provider for idempotency', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, bachsProvider, billingEventRepo, subscriptionRepo } = createService();
    (bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.failed',
      payment: {
        eventId: 'evt-bachs-fail',
        reference: 'ref-bachs-fail',
        tenantId,
        billingType: 'subscription_renewal',
      },
    });
    billingEventRepo.exists.mockResolvedValue(false);
    billingEventRepo.findOne.mockResolvedValue(null);
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.BACHS,
      status: SubscriptionStatus.PAST_DUE,
      dunningAttemptCount: 0,
    });
    const markFailedSpy = jest
      .spyOn(service as any, 'markRenewalFailed')
      .mockResolvedValue(undefined);

    await service.processBachsPayload({ event: 'invoice.payment_failed', data: {} });

    expect(markFailedSpy).toHaveBeenCalledTimes(1);
    expect(billingEventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-bachs-fail', provider: BillingProvider.BACHS }),
    );

    billingEventRepo.exists.mockResolvedValue(true);
    markFailedSpy.mockClear();

    await service.processBachsPayload({ event: 'invoice.payment_failed', data: {} });

    expect(markFailedSpy).not.toHaveBeenCalled();
  });

  it('ignores Bachs renewal webhooks when tenant billing provider is Polar', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, bachsProvider, subscriptionRepo } = createService();
    (bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-bachs-renewal',
        reference: 'ref-bachs-renewal',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: 'subscription_renewal',
        amount: 100,
        currency: 'USD',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.POLAR,
      status: SubscriptionStatus.ACTIVE,
    });
    const renewalSpy = jest
      .spyOn(service as any, 'processRenewalPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processBachsPayload({ event: 'invoice.paid', data: {} });

    expect(renewalSpy).not.toHaveBeenCalled();
  });

  it('processes Polar payment webhooks after Nomba→Polar provider switch at checkout', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, polarProvider, subscriptionRepo } = createService();
    (polarProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-polar-1',
        reference: 'ord_polar_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: 'subscription',
        amount: 100,
        currency: 'USD',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.POLAR,
      status: SubscriptionStatus.ACTIVE,
    });
    const initialSpy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processPolarPayload({ type: 'order.paid', data: {} });

    expect(initialSpy).toHaveBeenCalled();
  });
});

describe('SubscriptionBillingService lifecycle', () => {
  const createService = () => buildSubscriptionBillingService();

  it('schedules cancel at period end by default', async () => {
    const { service, subscriptionsService, subscriptionRepo } = createService();
    const subscription = {
      tenantId: 'tenant-1',
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
    };
    subscriptionsService.getTenantSubscription.mockResolvedValue(subscription);

    const result = await service.cancelSubscription('tenant-1', {});

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('cancels managed external subscription when user cancels', async () => {
    const { service, subscriptionsService, billingProviderFactory, subscriptionRepo } =
      createService();
    const subscription = {
      tenantId: 'tenant-1',
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_bachs_1',
      cancelAtPeriodEnd: false,
    };
    subscriptionsService.getTenantSubscription.mockResolvedValue(subscription);

    await service.cancelSubscription('tenant-1', { atPeriodEnd: true });

    expect(billingProviderFactory.cancelExternalSubscription).toHaveBeenCalledWith(
      BillingProvider.BACHS,
      'sub_bachs_1',
      true,
    );
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('routes card_update success to card handler', async () => {
    const { service, nombaProvider } = createService();
    (nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-card',
        reference: 'ref-card',
        tenantId: 'tenant-1',
        billingType: 'card_update',
        tokenKey: 'tok_new',
      },
    });
    const spy = jest.spyOn(service as any, 'processCardUpdateSuccess').mockResolvedValue(undefined);

    await service.handleNombaWebhook('{}', 'sig');

    expect(spy).toHaveBeenCalled();
  });
});

describe('SubscriptionBillingService seat sync', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;

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

  const baseSubscription = {
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
    planPrice,
    tenant: { createdBy: { email: 'billing@example.com' } },
  };

  const createService = () => {
    const built = buildSubscriptionBillingService();
    built.plansService.getPlanPriceById = jest.fn().mockResolvedValue(planPrice);
    built.subscriptionRepo.save = jest.fn(async (s) => s);
    return built;
  };

  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
  });

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('does nothing when live seats equal billed seats', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({ ...baseSubscription });
    tenantMemberRepo.count.mockResolvedValue(10);

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('lowers currentUsers without charging when seats decrease', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    const subscription = { ...baseSubscription, currentUsers: 11 };
    subscriptionRepo.findOne.mockResolvedValue(subscription);
    tenantMemberRepo.count.mockResolvedValue(10);

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentUsers: 10 }),
    );
  });

  it('charges prorated amount and sets pendingSeatCount when seats increase', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({ ...baseSubscription });
    tenantMemberRepo.count.mockResolvedValue(11);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-16T00:00:00.000Z'));

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).toHaveBeenCalledWith(
      'nomba_ref_1',
      planPrice,
      1750,
      11,
      1,
      'tok_123',
      'billing@example.com',
      expect.objectContaining({ extraSeats: 1, targetSeatCount: 11 }),
    );
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.objectContaining({
          pendingSeatCount: 11,
          pendingExtraSeats: 1,
          pendingChargeAmount: 1750,
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('skips a new charge while a seat addition payment is pending', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({
      ...baseSubscription,
      usageMetrics: { pendingSeatCount: 12 },
    });
    tenantMemberRepo.count.mockResolvedValue(13);

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });
});
