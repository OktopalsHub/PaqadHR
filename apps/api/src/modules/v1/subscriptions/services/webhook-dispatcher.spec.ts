import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { buildProviderDoubles, buildRepositoryDoubles, TENANT_ID } from './billing-test-doubles';
import { WebhookDispatcher } from './webhook-dispatcher';

/**
 * Webhook routing lives in WebhookDispatcher; the actual payment application lives in
 * PaymentSuccessHandlers. These specs drive the dispatcher with the handlers stubbed so
 * routing decisions (initial vs renewal vs quantity vs card-update, and staleness) are
 * asserted independently of the write path.
 */
function createDispatcher() {
  const providers = buildProviderDoubles();
  const repos = buildRepositoryDoubles();

  const renewalProcessor = { markRenewalFailed: jest.fn() };
  const productAnalytics = { track: jest.fn() };
  const eventResolver = {
    resolveWebhookSubscription: jest.fn().mockResolvedValue(undefined),
    enrichPaymentFromSubscription: jest.fn(),
    resolveWebhookTenantId: jest.fn().mockReturnValue(undefined),
    isStaleProviderWebhook: jest.fn().mockReturnValue(false),
  };
  const billingEventStore = {
    hasProcessedEvent: jest.fn().mockResolvedValue(false),
    recordBillingEvent: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((x) => x),
    findOne: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(false),
    save: jest.fn(),
  };
  const paymentHandlers = {
    processInitialPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    processRenewalPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    processQuantityUpdatePaymentSuccess: jest.fn().mockResolvedValue(undefined),
    processCardUpdateSuccess: jest.fn().mockResolvedValue(undefined),
  };

  const dispatcher = new WebhookDispatcher(
    repos.subscriptionRepo as never,
    providers.billingProviderFactory as never,
    { getPlanPriceById: jest.fn() } as never,
    renewalProcessor as never,
    productAnalytics as never,
    eventResolver as never,
    billingEventStore as never,
    paymentHandlers as never,
  );

  return {
    dispatcher,
    providers,
    repos,
    eventResolver,
    billingEventStore,
    paymentHandlers,
    renewalProcessor,
  };
}

/** Point the resolver at a subscription so billingType inference has history to read. */
function withSubscription(
  ctx: ReturnType<typeof createDispatcher>,
  subscription: Record<string, unknown>,
) {
  ctx.eventResolver.resolveWebhookSubscription.mockResolvedValue(subscription);
  ctx.eventResolver.resolveWebhookTenantId.mockReturnValue(TENANT_ID);
  ctx.repos.subscriptionRepo.findOne.mockResolvedValue(subscription);
  return ctx;
}

const paidHistory = [{ date: new Date(), amount: 100, currency: 'USD', status: 'paid' }];

describe('WebhookDispatcher.handleNombaWebhook', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects a missing webhook signature', async () => {
    const { dispatcher } = createDispatcher();
    await expect(dispatcher.handleNombaWebhook('{}', '')).rejects.toThrow(
      'Missing webhook signature',
    );
  });

  it('rejects an invalid webhook signature', async () => {
    const { dispatcher, providers } = createDispatcher();
    (providers.nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(false);

    await expect(dispatcher.handleNombaWebhook('{}', 'bad')).rejects.toThrow(
      'Invalid webhook signature',
    );
  });

  it('rejects malformed JSON without hitting the provider parser', async () => {
    const { dispatcher, providers } = createDispatcher();
    (providers.nombaProvider.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    await expect(dispatcher.handleNombaWebhook('not-json', 'sig')).rejects.toThrow(
      'Invalid webhook JSON',
    );
    expect(providers.nombaProvider.parseWebhook).not.toHaveBeenCalled();
  });
});

describe('WebhookDispatcher routing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('routes a first subscription payment to the initial-payment handler', async () => {
    const ctx = createDispatcher();
    (ctx.providers.nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-1',
        reference: 'ref-1',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'NGN',
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.NOMBA,
      billingHistory: [],
    });

    await ctx.dispatcher.processNombaPayload({ event_type: 'payment_success', data: {} });

    expect(ctx.paymentHandlers.processInitialPaymentSuccess).toHaveBeenCalled();
    expect(ctx.paymentHandlers.processRenewalPaymentSuccess).not.toHaveBeenCalled();
  });

  it('infers a renewal for a due managed cycle invoice with paid history', async () => {
    const ctx = createDispatcher();
    (ctx.providers.bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-bachs-cycle',
        reference: 'inv_cycle_1',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
        externalSubscriptionId: 'sub_ext_1',
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_ext_1',
      nextBillingDate: new Date(Date.now() - 86_400_000),
      billingHistory: paidHistory,
    });

    await ctx.dispatcher.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(ctx.paymentHandlers.processRenewalPaymentSuccess).toHaveBeenCalled();
    expect(ctx.paymentHandlers.processInitialPaymentSuccess).not.toHaveBeenCalled();
  });

  it('keeps the first cycle invoice on the initial handler when there is no history', async () => {
    const ctx = createDispatcher();
    (ctx.providers.bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-bachs-first',
        reference: 'inv_first_1',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
        externalSubscriptionId: 'sub_ext_1',
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_ext_1',
      nextBillingDate: new Date(Date.now() + 86_400_000),
      billingHistory: [],
    });

    await ctx.dispatcher.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(ctx.paymentHandlers.processInitialPaymentSuccess).toHaveBeenCalled();
    expect(ctx.paymentHandlers.processRenewalPaymentSuccess).not.toHaveBeenCalled();
  });

  it('routes a card_update charge to the card-update handler', async () => {
    const ctx = createDispatcher();
    (ctx.providers.nombaProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-card',
        reference: 'ref-card',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.CARD_UPDATE,
        tokenKey: 'tok_new',
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.NOMBA,
      billingHistory: [],
    });

    await ctx.dispatcher.processNombaPayload({ event_type: 'payment_success', data: {} });

    expect(ctx.paymentHandlers.processCardUpdateSuccess).toHaveBeenCalled();
  });

  it('ignores an event the provider reports as ignored', async () => {
    const ctx = createDispatcher();
    (ctx.providers.nombaProvider.parseWebhook as jest.Mock).mockReturnValue({ kind: 'ignored' });

    await expect(
      ctx.dispatcher.processNombaPayload({ event_type: 'payment_success', data: {} }),
    ).resolves.toEqual({ received: true });
    expect(ctx.paymentHandlers.processInitialPaymentSuccess).not.toHaveBeenCalled();
  });

  it('drops a stale provider webhook for a switched subscription', async () => {
    const ctx = createDispatcher();
    (ctx.providers.bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.success',
      payment: {
        eventId: 'evt-stale',
        reference: 'ref-stale',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION,
        amount: 100,
        currency: 'USD',
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.TRIAL,
      billingProvider: BillingProvider.POLAR,
      billingHistory: [],
    });
    ctx.eventResolver.isStaleProviderWebhook.mockReturnValue(true);

    await ctx.dispatcher.processBachsPayload({ type: 'invoice.paid', data: {} });

    expect(ctx.paymentHandlers.processInitialPaymentSuccess).not.toHaveBeenCalled();
    expect(ctx.paymentHandlers.processCardUpdateSuccess).not.toHaveBeenCalled();
  });

  it('skips a duplicated payment failure event', async () => {
    const ctx = createDispatcher();
    (ctx.providers.bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.failed',
      payment: {
        eventId: 'evt-bachs-fail',
        reference: 'ref-bachs-fail',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      },
    });
    withSubscription(ctx, {
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      dunningAttemptCount: 0,
      billingHistory: paidHistory,
    });
    ctx.billingEventStore.hasProcessedEvent.mockResolvedValue(true);

    await ctx.dispatcher.processBachsPayload({ event: 'invoice.payment_failed', data: {} });

    expect(ctx.repos.subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('hands a renewal failure to the renewal processor and records the event', async () => {
    const ctx = createDispatcher();
    (ctx.providers.bachsProvider.parseWebhook as jest.Mock).mockReturnValue({
      kind: 'payment.failed',
      payment: {
        eventId: 'evt-bachs-fail',
        reference: 'ref-bachs-fail',
        tenantId: TENANT_ID,
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      },
    });
    const subscription = {
      id: 'sub-1',
      tenantId: TENANT_ID,
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      dunningAttemptCount: 0,
      billingHistory: paidHistory,
    };
    withSubscription(ctx, subscription);

    await ctx.dispatcher.processBachsPayload({ event: 'invoice.payment_failed', data: {} });

    expect(ctx.renewalProcessor.markRenewalFailed).toHaveBeenCalledWith(
      subscription,
      'ref-bachs-fail',
      'renewal_payment_failed',
    );
    expect(ctx.billingEventStore.recordBillingEvent).toHaveBeenCalledWith(
      'evt-bachs-fail',
      'renewal_failed_webhook',
      expect.anything(),
      BillingProvider.BACHS,
    );
  });
});
