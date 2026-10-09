import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import {
  buildPlanPrice,
  buildProviderDoubles,
  buildRepositoryDoubles,
  TENANT_ID,
} from './billing-test-doubles';
import { RenewalLifecycleService } from './renewal-lifecycle.service';
import { RenewalProcessor } from './renewal-processor';
import { RenewalSuccessApplicator } from './renewal-success-applicator';

/**
 * Renewal behaviour lives in RenewalProcessor. These specs drive it directly; the
 * SubscriptionBillingService facade is only a pass-through.
 */
function createProcessor() {
  const providers = buildProviderDoubles();
  const repos = buildRepositoryDoubles();

  const seatPricing = {
    reclaimStuckPendingSeatCharges: jest.fn().mockResolvedValue(0),
    getTenantSeatCount: jest.fn().mockResolvedValue(1),
  };
  const renewalLifecycle = {
    suspendPastGraceSubscriptions: jest.fn().mockResolvedValue(0),
    finalizeScheduledCancellations: jest.fn().mockResolvedValue(undefined),
  };
  const plansService = { getPlanPriceById: jest.fn() };
  const tenantSettingsService = {
    getTenantSettings: jest
      .fn()
      .mockResolvedValue({ settings: { billing: { contactEmail: 'billing@example.com' } } }),
  };
  const paymentVerifier = {
    verifyTransaction: jest.fn(),
    verifyPaymentReference: jest.fn(),
    requiresProviderVerification: jest.fn().mockReturnValue(false),
  };
  const renewalSuccess = {
    applyRenewalSuccess: jest.fn(),
    getRenewalPeriodClaimStatus: jest.fn().mockResolvedValue(undefined),
    updateRenewalPeriodClaim: jest.fn(),
  };

  const processor = new RenewalProcessor(
    repos.subscriptionRepo as never,
    providers.billingProviderFactory as never,
    plansService as never,
    seatPricing as never,
    tenantSettingsService as never,
    paymentVerifier as never,
    renewalLifecycle as never,
    renewalSuccess as never,
  );

  return {
    processor,
    providers,
    repos,
    plansService,
    renewalLifecycle,
    renewalSuccess,
    paymentVerifier,
  };
}

const dueQueryBuilder = (subs: unknown[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(subs),
});

/** Spy on a private collaborator method without widening its declared type to `never`. */
function privateSpy(target: object, method: string): jest.Mock {
  const holder = target as unknown as { [key: string]: (...args: unknown[]) => unknown };
  return jest.spyOn(holder, method as keyof typeof holder) as unknown as jest.Mock;
}

async function chargeRenewal(processor: object, subscription: unknown): Promise<string> {
  return (
    processor as unknown as { chargeSubscriptionRenewal: (s: unknown) => Promise<string> }
  ).chargeSubscriptionRenewal(subscription);
}

const NOMBA_KEYS = ['NOMBA_CLIENT_ID', 'NOMBA_CLIENT_SECRET', 'NOMBA_PARENT_ACCOUNT_ID'] as const;

/** Set the Nomba credentials these suites need, and restore the originals afterwards. */
const configureNomba = () => {
  process.env.NOMBA_CLIENT_ID = 'client-id';
  process.env.NOMBA_CLIENT_SECRET = 'client-secret';
  process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
};

/**
 * Restore env vars, deleting any that were unset originally. Assigning `undefined` would
 * store the literal string "undefined" in the variable, which leaves Nomba looking
 * configured for every suite that runs after this one in the same worker.
 */
const restoreEnv = (saved: Record<string, string | undefined>) => {
  for (const [key, original] of Object.entries(saved)) {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
};

const restoreNomba = () => {
  restoreEnv(NOMBA_ORIGINAL);
  jest.restoreAllMocks();
};

const NOMBA_ORIGINAL: Record<(typeof NOMBA_KEYS)[number], string | undefined> = {
  NOMBA_CLIENT_ID: process.env.NOMBA_CLIENT_ID,
  NOMBA_CLIENT_SECRET: process.env.NOMBA_CLIENT_SECRET,
  NOMBA_PARENT_ACCOUNT_ID: process.env.NOMBA_PARENT_ACCOUNT_ID,
};

/**
 * Restoring `process.env.X = undefined` stores the literal string "undefined", which leaves
 * Nomba looking configured for every suite that runs after these in the same worker. Unset
 * variables must be deleted, not reassigned.
 */
describe('Nomba env hygiene', () => {
  afterEach(restoreNomba);

  it('deletes a variable whose original value was undefined', () => {
    const probe = 'NOMBA_RESTORE_PROBE';
    process.env[probe] = 'set-by-test';

    restoreEnv({ [probe]: undefined });

    // Assigning undefined would leave the literal string "undefined" here, which reads as
    // a configured credential to isNombaConfigured().
    expect(process.env[probe]).toBeUndefined();
    expect(process.env[probe]).not.toBe('undefined');
  });

  it('restores a variable that was previously set', () => {
    const probe = 'NOMBA_RESTORE_PROBE';
    process.env[probe] = 'set-by-test';

    restoreEnv({ [probe]: 'original-value' });

    expect(process.env[probe]).toBe('original-value');
    delete process.env[probe];
  });

  it('does not leave the string "undefined" in any Nomba variable after restore', () => {
    configureNomba();
    restoreNomba();

    for (const key of NOMBA_KEYS) {
      expect(process.env[key]).not.toBe('undefined');
    }
  });
});

describe('RenewalProcessor.processDueRenewals', () => {
  beforeEach(configureNomba);
  afterEach(restoreNomba);

  it('returns an empty result when the billing gateway is not configured', async () => {
    const billingConfig = require('../config/billing.config');
    jest.spyOn(billingConfig, 'isBillingGatewayEnabled').mockReturnValue(false);
    const { processor, providers } = createProcessor();

    await expect(processor.processDueRenewals()).resolves.toEqual({
      charged: 0,
      failed: 0,
      skipped: 0,
      suspended: 0,
    });
    expect(providers.billingProviderFactory.ensureConfigured).not.toHaveBeenCalled();
  });

  it('aggregates outcomes across due renewals and counts suspensions', async () => {
    const { processor, repos, renewalLifecycle } = createProcessor();
    repos.subscriptionRepo.createQueryBuilder.mockReturnValue(
      dueQueryBuilder([{ id: 'sub-1' }, { id: 'sub-2' }, { id: 'sub-3' }]),
    );
    renewalLifecycle.suspendPastGraceSubscriptions.mockResolvedValue(2);

    const chargeSpy = privateSpy(processor, 'chargeSubscriptionRenewal')
      .mockResolvedValueOnce('charged')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('skipped');

    await expect(processor.processDueRenewals()).resolves.toEqual({
      charged: 1,
      failed: 1,
      skipped: 1,
      suspended: 2,
    });
    expect(chargeSpy).toHaveBeenCalledTimes(3);
  });
});

describe('RenewalProcessor.chargeSubscriptionRenewal', () => {
  beforeEach(configureNomba);
  afterEach(restoreNomba);

  const dueSubscription = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub-retry',
    nextBillingDate: new Date('2026-06-01T00:00:00.000Z'),
    tenantId: TENANT_ID,
    planPriceId: 'price-1',
    planId: 'plan-1',
    paymentMethodId: 'tok_123',
    nombaSubscriptionId: 'nomba_ref_1',
    status: SubscriptionStatus.ACTIVE,
    dunningAttemptCount: 0,
    billingProvider: BillingProvider.NOMBA,
    ...overrides,
  });

  it('skips the charge when the billing period was already claimed at the provider', async () => {
    // Idempotency now lives in the period claim, not a heal pass over provider history.
    const { processor, renewalSuccess, providers } = createProcessor();
    renewalSuccess.getRenewalPeriodClaimStatus.mockResolvedValue('charged');

    await expect(chargeRenewal(processor, dueSubscription())).resolves.toBe('skipped');
    expect(providers.nombaProvider.chargeRenewal).not.toHaveBeenCalled();
  });

  it('claims the period before charging so a retry cannot double-bill', async () => {
    const { processor, renewalSuccess, providers, plansService, paymentVerifier } =
      createProcessor();
    plansService.getPlanPriceById.mockResolvedValue(buildPlanPrice());
    renewalSuccess.getRenewalPeriodClaimStatus.mockResolvedValue(undefined);
    paymentVerifier.verifyPaymentReference.mockResolvedValue({ status: 'success', amount: 100 });
    paymentVerifier.requiresProviderVerification.mockReturnValue(false);

    await chargeRenewal(
      processor,
      dueSubscription({ status: SubscriptionStatus.PAST_DUE, dunningAttemptCount: 1 }),
    );

    expect(renewalSuccess.updateRenewalPeriodClaim).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'pending' }),
      BillingProvider.NOMBA,
    );
    expect(providers.nombaProvider.chargeRenewal).toHaveBeenCalled();
  });
});

describe('RenewalProcessor.buildNombaRenewalOrderReference', () => {
  it('is deterministic and stays within the Nomba length limit', () => {
    const { processor } = createProcessor();
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const date = new Date('2026-06-01T00:00:00.000Z');

    const first = processor.buildNombaRenewalOrderReference(id, date);
    const second = processor.buildNombaRenewalOrderReference(id, date);

    expect(first).toBe(second);
    expect(first.length).toBeLessThanOrEqual(50);
    expect(first).toMatch(/^sub_ren_/);
  });
});

describe('RenewalLifecycleService.lapseStaleSubscriptions', () => {
  // RenewalProcessor.lapseStaleSubscriptions is a pass-through to this service.
  it('lapses stale Polar and Monnify subscriptions past grace', async () => {
    const repos = buildRepositoryDoubles();
    const lifecycle = new RenewalLifecycleService(
      repos.subscriptionRepo as never,
      repos.tenantRepo as never,
      repos.tenantMemberRepo as never,
      { hasProcessedEvent: jest.fn(), record: jest.fn() } as never,
    );
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
    repos.subscriptionRepo.find.mockResolvedValue([polarSub, monnifySub]);

    await expect(lifecycle.lapseStaleSubscriptions()).resolves.toEqual({ lapsed: 2 });
    expect(polarSub.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(monnifySub.status).toBe(SubscriptionStatus.PAST_DUE);
  });
});

describe('RenewalSuccessApplicator.applyRenewalSuccess', () => {
  // The applicator owns the post-renewal write; RenewalProcessor only delegates to it.
  function createApplicator() {
    const repos = buildRepositoryDoubles();
    const plansService = { getPlanPriceById: jest.fn().mockResolvedValue(buildPlanPrice()) };
    const seatPricing = { getTenantSeatCount: jest.fn().mockResolvedValue(1) };
    const renewalLifecycle = { resetDunningFields: jest.fn() };
    const billingEventStore = { hasProcessedEvent: jest.fn() };

    const manager = {
      getRepository: (entity: { name?: string }) =>
        entity.name === 'BillingEvent' ? repos.billingEventRepo : repos.subscriptionRepo,
    };
    const dataSource = {
      transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(manager)),
    };

    const applicator = new RenewalSuccessApplicator(
      repos.subscriptionRepo as never,
      plansService as never,
      seatPricing as never,
      dataSource as never,
      billingEventStore as never,
      renewalLifecycle as never,
    );

    return { applicator, repos, plansService, seatPricing, renewalLifecycle };
  }

  const renewalPayment = () => ({
    eventId: 'evt-ren-1',
    reference: 'sub_ren_period_1',
    tenantId: TENANT_ID,
    planId: 'plan-1',
    planPriceId: 'price-1',
    amount: 100,
    currency: 'NGN',
    status: 'success',
    billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
  });

  const dueSubscription = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    tenantId: TENANT_ID,
    status: SubscriptionStatus.ACTIVE,
    billingProvider: BillingProvider.NOMBA,
    planId: 'plan-1',
    planPriceId: 'price-1',
    nextBillingDate: new Date(Date.now() - 86_400_000),
    currentUsers: 1,
    nombaSubscriptionId: 'original_checkout_ref',
    cancelAtPeriodEnd: false,
    billingHistory: [],
    ...overrides,
  });

  it('advances the billing period and records the paid invoice', async () => {
    const { applicator, repos, renewalLifecycle } = createApplicator();
    repos.subscriptionRepo.findOne.mockResolvedValue(dueSubscription());
    const anchor = new Date('2026-06-01T00:00:00.000Z');

    await applicator.applyRenewalSuccess(
      TENANT_ID,
      renewalPayment(),
      BillingProvider.NOMBA,
      anchor,
    );

    expect(renewalLifecycle.resetDunningFields).toHaveBeenCalled();
    expect(repos.subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
        billingHistory: [expect.objectContaining({ amount: 100, status: 'paid' })],
      }),
    );
    // The checkout reference must survive a renewal; overwriting it breaks future charges.
    expect(repos.subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombaSubscriptionId: 'original_checkout_ref' }),
    );
  });

  it('does not renew a subscription already scheduled to cancel at period end', async () => {
    const { applicator, repos } = createApplicator();
    repos.subscriptionRepo.findOne.mockResolvedValue(dueSubscription({ cancelAtPeriodEnd: true }));

    await applicator.applyRenewalSuccess(TENANT_ID, renewalPayment());

    expect(repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('does not renew before the billing date is due', async () => {
    const { applicator, repos } = createApplicator();
    repos.subscriptionRepo.findOne.mockResolvedValue(
      dueSubscription({ nextBillingDate: new Date(Date.now() + 30 * 86_400_000) }),
    );

    await applicator.applyRenewalSuccess(TENANT_ID, renewalPayment());

    expect(repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('ignores a renewal for a subscription already billed under another provider', async () => {
    const { applicator, repos } = createApplicator();
    repos.subscriptionRepo.findOne.mockResolvedValue(
      dueSubscription({ billingProvider: BillingProvider.POLAR }),
    );

    await applicator.applyRenewalSuccess(TENANT_ID, renewalPayment(), BillingProvider.NOMBA);

    expect(repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent for a duplicated webhook event', async () => {
    const { applicator, repos } = createApplicator();
    repos.subscriptionRepo.findOne.mockResolvedValue(dueSubscription());
    repos.billingEventRepo.findOne.mockResolvedValue({ eventId: 'evt-ren-1' });

    await applicator.applyRenewalSuccess(TENANT_ID, renewalPayment());

    expect(repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });
});
