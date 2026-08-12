import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { SubscriptionBillingService } from './subscription-billing.service';

function buildSubscriptionBillingService(nombaProviderOverrides: Record<string, unknown> = {}) {
  const nombaProvider = {
    ensureConfigured: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhook: jest.fn(),
    createCardUpdateCheckout: jest.fn(),
    chargeSeatAddition: jest.fn().mockResolvedValue({ orderReference: 'sub_qty_1' }),
    chargeRenewal: jest.fn().mockResolvedValue({ orderReference: 'sub_ren_mock' }),
    ...nombaProviderOverrides,
  };
  const bachsProvider = {
    parseWebhook: jest.fn(),
  };
  const polarProvider = {
    parseWebhook: jest.fn(),
  };
  const monnifyProvider = {
    parseWebhook: jest.fn(),
  };
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
  };
  const nombaApi = { verifyTransaction: jest.fn() };
  const monnifyApi = { verifyTransaction: jest.fn() };
  const subscriptionsService = {
    getBillingStatus: jest.fn(),
    getTenantSubscription: jest.fn(),
    computeNeedsPayment: jest.fn().mockReturnValue(false),
  };
  const tenantSettingsService = { getTenantSettings: jest.fn() };
  const plansService = {
    getPlanPriceById: jest.fn(),
    findPlanBySlug: jest.fn(),
    getPlanPrice: jest.fn(),
    getPricesForCountry: jest.fn().mockResolvedValue([]),
  };
  const subscriptionRepo = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(async (s) => s),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const tenantRepo = { findOne: jest.fn(), save: jest.fn(async (t) => t) };
  const userRepo = { findOne: jest.fn() };
  const tenantMemberRepo = { count: jest.fn(), findOne: jest.fn() };
  const billingEventRepo = {
    exists: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (manager: unknown) => Promise<unknown>) =>
      fn({
        getRepository: (entity: { name?: string }) => {
          const name = typeof entity === 'function' ? (entity as { name: string }).name : '';
          if (name === 'BillingEvent') {
            return billingEventRepo;
          }
          return subscriptionRepo;
        },
      }),
    ),
  };

  const service = new SubscriptionBillingService(
    billingProviderFactory as never,
    nombaApi as never,
    monnifyApi as never,
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
    monnifyProvider,
    billingProviderFactory,
    subscriptionsService,
    subscriptionRepo,
    billingEventRepo,
    tenantMemberRepo,
    tenantSettingsService,
    tenantRepo,
    userRepo,
    plansService,
    nombaApi,
    monnifyApi,
    dataSource,
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

  it('skips renewal charge when billing period was already renewed', async () => {
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
      billingProvider: BillingProvider.NOMBA,
    };

    jest.spyOn(service as any, 'healRenewalFromExistingPeriodCharge').mockResolvedValue('skip');

    const outcome = await (service as any).chargeSubscriptionRenewal(subscription);

    expect(outcome).toBe('skipped');
  });

  it('does not charge again on dunning retry when prior period charge succeeded at provider', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
    const { service, nombaProvider } = createService();
    const nextBillingDate = new Date('2026-06-01T00:00:00.000Z');
    const subscription = {
      id: 'sub-retry',
      nextBillingDate,
      tenantId: '11111111-1111-4111-8111-111111111111',
      planPriceId: 'price-1',
      planId: 'plan-1',
      paymentMethodId: 'tok_123',
      nombaSubscriptionId: 'nomba_ref_1',
      status: SubscriptionStatus.PAST_DUE,
      dunningAttemptCount: 1,
      billingProvider: BillingProvider.NOMBA,
    };

    const healSpy = jest
      .spyOn(service as any, 'healRenewalFromExistingPeriodCharge')
      .mockResolvedValue('charged');
    const claimSpy = jest.spyOn(service as any, 'claimRenewalPeriodCharge');

    const outcome = await (service as any).chargeSubscriptionRenewal(subscription);

    expect(outcome).toBe('charged');
    expect(healSpy).toHaveBeenCalled();
    expect(claimSpy).not.toHaveBeenCalled();
    expect(nombaProvider.chargeRenewal).not.toHaveBeenCalled();
  });

  it('persists deterministic orderReference before Nomba charge and heals without recharging', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
    const { service, nombaProvider, nombaApi, plansService, billingEventRepo } = createService();
    const nextBillingDate = new Date('2026-06-01T00:00:00.000Z');
    const subscriptionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const expectedRef = (service as any).buildNombaRenewalOrderReference(
      subscriptionId,
      nextBillingDate,
    );
    const subscription = {
      id: subscriptionId,
      nextBillingDate,
      tenantId: '11111111-1111-4111-8111-111111111111',
      planPriceId: 'price-1',
      planId: 'plan-1',
      paymentMethodId: 'tok_123',
      nombaSubscriptionId: 'nomba_checkout_1',
      status: SubscriptionStatus.ACTIVE,
      dunningAttemptCount: 0,
      billingProvider: BillingProvider.NOMBA,
      tenant: { createdBy: { email: 'owner@example.com' } },
    };

    jest.spyOn(service as any, 'healRenewalFromExistingPeriodCharge').mockResolvedValue('none');
    jest.spyOn(service as any, 'claimRenewalPeriodCharge').mockResolvedValue('proceed');
    jest.spyOn(service as any, 'resolveBillingEmail').mockResolvedValue('owner@example.com');
    jest.spyOn(service as any, 'getTenantSeatCount').mockResolvedValue(1);
    plansService.getPlanPriceById.mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      isActive: true,
      currency: 'NGN',
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    });
    jest.spyOn(service as any, 'applyRenewalSuccess').mockResolvedValue(undefined);
    billingEventRepo.findOne.mockResolvedValue(null);
    nombaProvider.chargeRenewal.mockResolvedValue({ orderReference: expectedRef });
    nombaApi.verifyTransaction.mockResolvedValue({ status: 'success', amount: 100 });

    const outcome = await (service as any).chargeSubscriptionRenewal(subscription);

    expect(outcome).toBe('charged');
    expect(nombaProvider.chargeRenewal).toHaveBeenCalledWith(
      'nomba_checkout_1',
      expect.anything(),
      1,
      'tok_123',
      'owner@example.com',
      expect.objectContaining({ orderReference: expectedRef }),
    );
  });

  it('buildNombaRenewalOrderReference is deterministic and within Nomba length limit', () => {
    const { service } = createService();
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const date = new Date('2026-06-01T00:00:00.000Z');
    const a = (service as any).buildNombaRenewalOrderReference(id, date);
    const b = (service as any).buildNombaRenewalOrderReference(id, date);
    expect(a).toBe(b);
    expect(a.length).toBeLessThanOrEqual(50);
    expect(a).toMatch(/^sub_ren_/);
  });

  it('does not overwrite nombaSubscriptionId on renewal success', async () => {
    const { service, subscriptionRepo, billingEventRepo, plansService } = createService();
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const locked = {
      id: 'sub-1',
      tenantId,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.NOMBA,
      planId: 'plan-1',
      planPriceId: 'price-1',
      nextBillingDate: new Date('2026-06-01T00:00:00.000Z'),
      currentUsers: 1,
      nombaSubscriptionId: 'original_checkout_ref',
      cancelAtPeriodEnd: false,
      billingHistory: [],
    };
    subscriptionRepo.findOne.mockResolvedValue(locked);
    billingEventRepo.findOne.mockResolvedValue(null);
    plansService.getPlanPriceById.mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      isActive: true,
      currency: 'NGN',
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    });

    await (service as any).applyRenewalSuccess(
      tenantId,
      {
        eventId: 'evt-ren-1',
        reference: 'sub_ren_period_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        amount: 100,
        currency: 'NGN',
        status: 'success',
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      },
      BillingProvider.NOMBA,
      locked.nextBillingDate,
    );

    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombaSubscriptionId: 'original_checkout_ref' }),
    );
  });

  it('lapses stale Polar and Monnify subscriptions past grace', async () => {
    const { service, subscriptionRepo } = createService();
    const staleDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const polarSub = {
      id: 'polar-1',
      tenantId: 't1',
      billingProvider: BillingProvider.POLAR,
      status: SubscriptionStatus.ACTIVE,
      externalSubscriptionId: 'pol_1',
      nextBillingDate: staleDate,
    };
    const monnifySub = {
      id: 'mon-1',
      tenantId: 't2',
      billingProvider: BillingProvider.MONNIFY,
      status: SubscriptionStatus.ACTIVE,
      nextBillingDate: staleDate,
    };
    subscriptionRepo.find.mockResolvedValue([polarSub, monnifySub]);

    const result = await service.lapseStaleSubscriptions();

    expect(result.lapsed).toBe(2);
    expect(polarSub.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(monnifySub.status).toBe(SubscriptionStatus.PAST_DUE);
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

  it('routes Bachs invoice.paid to renewal handler for due cycle invoices', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, bachsProvider, subscriptionRepo } = createService();
    (bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-bachs-cycle',
        reference: 'inv_cycle_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
        externalSubscriptionId: 'sub_ext_1',
        nextBillingDate: '2026-09-01T00:00:00.000Z',
        currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.BACHS,
      status: SubscriptionStatus.ACTIVE,
      externalSubscriptionId: 'sub_ext_1',
      nextBillingDate: new Date('2026-07-01T00:00:00.000Z'),
      billingHistory: [{ date: new Date(), amount: 100, currency: 'USD', status: 'paid' }],
    });
    const renewalSpy = jest
      .spyOn(service as any, 'processRenewalPaymentSuccess')
      .mockResolvedValue(undefined);
    const initialSpy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(renewalSpy).toHaveBeenCalled();
    expect(initialSpy).not.toHaveBeenCalled();
  });

  it('keeps first Bachs invoice.paid on initial handler before any billing history', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, bachsProvider, subscriptionRepo } = createService();
    (bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-bachs-first',
        reference: 'inv_first_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
        externalSubscriptionId: 'sub_ext_1',
        nextBillingDate: '2026-09-01T00:00:00.000Z',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.BACHS,
      status: SubscriptionStatus.ACTIVE,
      externalSubscriptionId: 'sub_ext_1',
      nextBillingDate: new Date('2026-09-01T00:00:00.000Z'),
      billingHistory: [],
    });
    const renewalSpy = jest
      .spyOn(service as any, 'processRenewalPaymentSuccess')
      .mockResolvedValue(undefined);
    const initialSpy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(initialSpy).toHaveBeenCalled();
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

  it('routes Polar cycle order.paid to renewal when history exists and period is due', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, polarProvider, subscriptionRepo } = createService();
    (polarProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-polar-cycle',
        reference: 'ord_cycle_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 99,
        currency: 'USD',
        externalSubscriptionId: 'pol_sub_1',
        nextBillingDate: '2026-09-01T00:00:00.000Z',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.POLAR,
      status: SubscriptionStatus.ACTIVE,
      externalSubscriptionId: 'pol_sub_1',
      nextBillingDate: new Date('2026-07-01T00:00:00.000Z'),
      billingHistory: [{ date: new Date(), amount: 99, currency: 'USD', status: 'paid' }],
    });
    const renewalSpy = jest
      .spyOn(service as any, 'processRenewalPaymentSuccess')
      .mockResolvedValue(undefined);
    const initialSpy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processPolarPayload({ type: 'order.paid', data: {} });

    expect(renewalSpy).toHaveBeenCalled();
    expect(initialSpy).not.toHaveBeenCalled();
  });

  it('routes overdue Monnify checkout payment to renewal recovery', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const {
      service,
      monnifyProvider,
      subscriptionRepo,
      monnifyApi,
      plansService,
      billingEventRepo,
      tenantRepo,
    } = createService();
    (monnifyProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-mon-ren',
        reference: 'mon_ref_ren',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        amount: 100,
        currency: 'NGN',
        billingType: BillingChargeType.SUBSCRIPTION,
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.MONNIFY,
      planId: 'plan-1',
      planPriceId: 'price-1',
      nextBillingDate: new Date('2026-06-01T00:00:00.000Z'),
    });
    tenantRepo.findOne.mockResolvedValue({ id: tenantId });
    billingEventRepo.exists.mockResolvedValue(false);
    billingEventRepo.findOne.mockResolvedValue(null);
    monnifyApi.verifyTransaction.mockResolvedValue({ paid: true, amount: 100 });
    plansService.getPlanPriceById.mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      isActive: true,
      currency: 'NGN',
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    });
    jest.spyOn(service as any, 'getTenantSeatCount').mockResolvedValue(1);
    const renewalSpy = jest
      .spyOn(service as any, 'applyRenewalSuccess')
      .mockResolvedValue(undefined);

    await service.processMonnifyPayload({ eventType: 'SUCCESSFUL_TRANSACTION', eventData: {} });

    expect(renewalSpy).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        reference: 'mon_ref_ren',
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      }),
      BillingProvider.MONNIFY,
      expect.any(Date),
    );
  });

  it('skips duplicate Monnify initial payment when already paid this period', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, monnifyProvider, subscriptionRepo, billingEventRepo } = createService();
    const futureBilling = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    (monnifyProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-mon-dup',
        reference: 'mon_dup',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        amount: 100,
        currency: 'NGN',
        billingType: BillingChargeType.SUBSCRIPTION,
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.MONNIFY,
      planId: 'plan-1',
      planPriceId: 'price-1',
      nextBillingDate: futureBilling,
    });
    billingEventRepo.exists.mockResolvedValue(false);
    const renewalSpy = jest
      .spyOn(service as any, 'applyRenewalSuccess')
      .mockResolvedValue(undefined);
    const recordSpy = jest.spyOn(service as any, 'recordBillingEvent').mockResolvedValue(undefined);

    await service.processMonnifyPayload({ eventType: 'SUCCESSFUL_TRANSACTION', eventData: {} });

    expect(renewalSpy).not.toHaveBeenCalled();
    expect(recordSpy).toHaveBeenCalledWith(
      'evt-mon-dup',
      'payment_success_skipped',
      expect.objectContaining({ reason: 'already_paid_current_period' }),
      BillingProvider.MONNIFY,
    );
  });

  it('allows trial subscription checkout webhooks from the provider taking over', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, polarProvider, subscriptionRepo } = createService();
    (polarProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-polar-trial-checkout',
        reference: 'ord_polar_trial_1',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.NOMBA,
      status: SubscriptionStatus.TRIAL,
    });
    const initialSpy = jest
      .spyOn(service as any, 'processInitialPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processPolarPayload({ type: 'order.paid', data: {} });

    expect(initialSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores stale card update webhooks during trial provider switch', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, polarProvider, subscriptionRepo } = createService();
    (polarProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-polar-card-update',
        reference: 'ord_polar_card_1',
        tenantId,
        billingType: BillingChargeType.CARD_UPDATE,
        tokenKey: 'tok_trial_switch',
        amount: 100,
        currency: 'USD',
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      billingProvider: BillingProvider.NOMBA,
      status: SubscriptionStatus.TRIAL,
    });
    const cardUpdateSpy = jest
      .spyOn(service as any, 'processCardUpdateSuccess')
      .mockResolvedValue(undefined);

    await service.processPolarPayload({ type: 'order.updated', data: {} });

    expect(cardUpdateSpy).not.toHaveBeenCalled();
  });

  it('skips duplicate initial payment when subscription is already paid this period', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, nombaProvider, subscriptionRepo, billingEventRepo, plansService } =
      createService();
    const futureBilling = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    (nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-dup',
        reference: 'ref-dup',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        amount: 100,
        currency: 'NGN',
        tokenKey: 'tok_1',
        billingType: BillingChargeType.SUBSCRIPTION,
      },
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.NOMBA,
      planId: 'plan-1',
      planPriceId: 'price-1',
      nextBillingDate: futureBilling,
    });
    billingEventRepo.exists.mockResolvedValue(false);
    plansService.getPlanPriceById.mockResolvedValue({
      isActive: true,
      planId: 'plan-1',
      currency: 'NGN',
      calculateMonthlyPrice: () => [],
    });
    const renewalSpy = jest
      .spyOn(service as any, 'applyRenewalSuccess')
      .mockResolvedValue(undefined);
    const recordSpy = jest.spyOn(service as any, 'recordBillingEvent').mockResolvedValue(undefined);

    await service.processNombaPayload({ event_type: 'payment_success', data: {} });

    expect(renewalSpy).not.toHaveBeenCalled();
    expect(recordSpy).toHaveBeenCalledWith(
      'evt-dup',
      'payment_success_skipped',
      expect.objectContaining({ reason: 'already_paid_current_period' }),
      BillingProvider.NOMBA,
    );
  });

  it('enriches Bachs cycle invoice missing metadata from externalSubscriptionId', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, bachsProvider, subscriptionRepo } = createService();
    const payment: {
      eventId: string;
      reference: string;
      tenantId: string;
      planId?: string;
      planPriceId?: string;
      billingType: BillingChargeType;
      amount: number;
      currency: string;
      externalSubscriptionId: string;
      nextBillingDate: string;
    } = {
      eventId: 'evt-bachs-empty-meta',
      reference: 'inv_empty_1',
      tenantId: '',
      billingType: BillingChargeType.SUBSCRIPTION,
      amount: 100,
      currency: 'USD',
      externalSubscriptionId: 'sub_ext_meta',
      nextBillingDate: '2026-09-01T00:00:00.000Z',
    };
    (bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment,
    });
    subscriptionRepo.findOne.mockResolvedValue({
      tenantId,
      planId: 'plan-1',
      planPriceId: 'price-1',
      billingProvider: BillingProvider.BACHS,
      status: SubscriptionStatus.ACTIVE,
      externalSubscriptionId: 'sub_ext_meta',
      nextBillingDate: new Date('2026-07-01T00:00:00.000Z'),
      currentUsers: 2,
      billingHistory: [{ date: new Date(), amount: 100, currency: 'USD', status: 'paid' }],
    });
    const renewalSpy = jest
      .spyOn(service as any, 'processRenewalPaymentSuccess')
      .mockResolvedValue(undefined);

    await service.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(payment.tenantId).toBe(tenantId);
    expect(payment.planId).toBe('plan-1');
    expect(payment.planPriceId).toBe('price-1');
    expect(renewalSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, planId: 'plan-1', planPriceId: 'price-1' }),
      BillingProvider.BACHS,
    );
  });

  it('ignores renewal when cancelAtPeriodEnd is scheduled', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const { service, subscriptionRepo, billingEventRepo, plansService } = createService();
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      tenantId,
      planId: 'plan-1',
      planPriceId: 'price-1',
      billingProvider: BillingProvider.BACHS,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      nextBillingDate: new Date('2026-07-01T00:00:00.000Z'),
      currentUsers: 1,
    });
    plansService.getPlanPriceById.mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      isActive: true,
      currency: 'USD',
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    });
    billingEventRepo.findOne.mockResolvedValue(null);

    await (service as any).applyRenewalSuccess(
      tenantId,
      {
        eventId: 'evt-cancel-renewal',
        reference: 'inv_cancel',
        tenantId,
        planId: 'plan-1',
        planPriceId: 'price-1',
        amount: 100,
        currency: 'USD',
        status: 'success',
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      },
      BillingProvider.BACHS,
    );

    expect(billingEventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-cancel-renewal',
        eventType: 'renewal_ignored_cancel_scheduled',
      }),
    );
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });
});

describe('SubscriptionBillingService checkout guards', () => {
  const createService = () => buildSubscriptionBillingService();
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupCheckoutBase = (deps: ReturnType<typeof createService>) => {
    deps.plansService.findPlanBySlug.mockResolvedValue({ slug: 'scale', isActive: true });
    deps.tenantRepo.findOne.mockResolvedValue({
      id: tenantId,
      slug: 'acme',
      countryCode: 'NG',
      preferredCurrency: 'NGN',
    });
    deps.userRepo.findOne.mockResolvedValue({ id: userId, email: 'owner@example.com' });
    deps.billingProviderFactory.resolveBillingProvider.mockReturnValue(BillingProvider.BACHS);
    deps.plansService.getPlanPrice.mockResolvedValue({
      id: 'price-1',
      planId: 'plan-1',
      currency: 'USD',
      isActive: true,
      monthlyPrice: 100,
      calculateMonthlyPrice: () => ({ totalPrice: 100 }),
    });
    deps.tenantMemberRepo.count.mockResolvedValue(1);
    deps.tenantMemberRepo.findOne.mockResolvedValue({ id: 'member-1' });
    (deps.bachsProvider as any).createCheckout = jest.fn().mockResolvedValue({
      id: 'chk_1',
      checkoutUrl: 'https://checkout.example',
      reference: 'ref_1',
    });
    deps.billingProviderFactory.getProviderForCountry.mockReturnValue(deps.bachsProvider as never);
  };

  it('allows TRIAL same-plan checkout', async () => {
    process.env.BACHS_SECRET_KEY = 'bachs-secret';
    const deps = createService();
    setupCheckoutBase(deps);
    deps.subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.TRIAL,
      plan: { slug: 'scale' },
      billingProvider: BillingProvider.BACHS,
    });

    const result = await deps.service.createSubscriptionCheckout(tenantId, 'scale', userId);

    expect(result.reference).toBe('ref_1');
    expect((deps.bachsProvider as any).createCheckout).toHaveBeenCalled();
  });

  it('blocks ACTIVE same-plan checkout', async () => {
    const deps = createService();
    setupCheckoutBase(deps);
    deps.subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      plan: { slug: 'scale' },
      billingProvider: BillingProvider.BACHS,
      nextBillingDate: new Date(Date.now() + 86400000),
    });

    await expect(
      deps.service.createSubscriptionCheckout(tenantId, 'scale', userId),
    ).rejects.toThrow('already has an active subscription');
  });

  it('blocks PAST_DUE managed checkout when externalSubscriptionId exists', async () => {
    const deps = createService();
    setupCheckoutBase(deps);
    deps.subscriptionsService.getTenantSubscription.mockResolvedValue({
      status: SubscriptionStatus.PAST_DUE,
      plan: { slug: 'starter' },
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_bachs_past_due',
      paymentMethodId: 'sub_bachs_past_due',
    });

    await expect(
      deps.service.createSubscriptionCheckout(tenantId, 'scale', userId),
    ).rejects.toThrow('past due with an active provider subscription');
  });
});

describe('SubscriptionBillingService billing overview privacy', () => {
  const createService = () => buildSubscriptionBillingService();

  it('hides ownerEmail and billingContact from non-managers', async () => {
    const { service, tenantRepo, subscriptionsService, tenantSettingsService, tenantMemberRepo } =
      createService();
    const tenantId = '11111111-1111-4111-8111-111111111111';
    tenantRepo.findOne.mockResolvedValue({
      id: tenantId,
      name: 'Acme',
      countryCode: 'US',
      preferredCurrency: 'USD',
      createdBy: { email: 'owner@example.com' },
    });
    subscriptionsService.getBillingStatus.mockResolvedValue({
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
    });
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      nextBillingDate: new Date(),
      billingHistory: [],
      billingProvider: BillingProvider.BACHS,
    });
    tenantSettingsService.getTenantSettings.mockResolvedValue({
      settings: { billing: { contactEmail: 'billing@example.com' } },
    });
    tenantMemberRepo.count.mockResolvedValue(1);

    const overview = await service.getBillingOverview(tenantId, false);

    expect(overview.ownerEmail).toBeNull();
    expect(overview.billingContact).toEqual({});
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

  it('uncancels managed provider before clearing cancelAtPeriodEnd', async () => {
    const { service, subscriptionsService, billingProviderFactory, subscriptionRepo } =
      createService();
    const subscription = {
      tenantId: 'tenant-1',
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.POLAR,
      externalSubscriptionId: 'sub_polar_1',
      cancelAtPeriodEnd: true,
      paymentMethodId: 'pm_1',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    };
    subscriptionsService.getTenantSubscription.mockResolvedValue(subscription);

    await service.resumeSubscription('tenant-1');

    expect(billingProviderFactory.resumeExternalSubscription).toHaveBeenCalledWith(
      BillingProvider.POLAR,
      'sub_polar_1',
    );
    expect(subscription.cancelAtPeriodEnd).toBe(false);
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('rejects undo when there is no scheduled cancellation', async () => {
    const { service, subscriptionsService } = createService();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      tenantId: 'tenant-1',
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      paymentMethodId: 'pm_1',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(service.resumeSubscription('tenant-1')).rejects.toThrow(
      /No scheduled cancellation/,
    );
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
          pendingSeatChargedAt: expect.any(String),
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('skips a new charge while a fresh seat addition payment is pending', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({
      ...baseSubscription,
      usageMetrics: {
        pendingSeatCount: 12,
        pendingSeatChargedAt: new Date().toISOString(),
      },
    });
    tenantMemberRepo.count.mockResolvedValue(12);

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('clears legacy pending seat locks without a timestamp and retries', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({
      ...baseSubscription,
      usageMetrics: { pendingSeatCount: 12 },
    });
    tenantMemberRepo.count.mockResolvedValue(11);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-16T00:00:00.000Z'));

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('applies seat decreases even while a pending seat charge exists', async () => {
    const { service, subscriptionRepo, tenantMemberRepo, nombaProvider } = createService();
    subscriptionRepo.findOne.mockResolvedValue({
      ...baseSubscription,
      currentUsers: 12,
      usageMetrics: {
        pendingSeatCount: 13,
        pendingSeatChargedAt: new Date().toISOString(),
      },
    });
    tenantMemberRepo.count.mockResolvedValue(10);

    await service.syncSubscriptionQuantity('tenant-1');

    expect(nombaProvider.chargeSeatAddition).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUsers: 10,
        usageMetrics: expect.objectContaining({
          pendingSeatCount: undefined,
        }),
      }),
    );
  });
});

describe('SubscriptionBillingService resume guards', () => {
  it('rejects resume for cancelled subscriptions', async () => {
    const { service, subscriptionsService } = buildSubscriptionBillingService();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      tenantId: 'tenant-1',
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
      paymentMethodId: 'tok',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(service.resumeSubscription('tenant-1')).rejects.toThrow(/cancelled/i);
  });
});
