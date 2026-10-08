import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BillingProvider } from '../constants/billing-provider.enum';
import { SubscriptionBillingService } from './subscription-billing.service';

/**
 * SubscriptionBillingService is now a thin facade over RenewalProcessor,
 * WebhookDispatcher, SubscriptionCheckoutService, BillingOverviewService and
 * SeatPricingCalculator. Behaviour for each of those lives in a spec next to its owner:
 *
 *   renewal-processor.spec.ts           renewal jobs + renewal success writes
 *   webhook-dispatcher.spec.ts          provider webhook routing and failures
 *   subscription-checkout.service.spec.ts  checkout guards
 *   billing-overview.service.spec.ts    overview assembly and privacy
 *   seat-pricing-calculator.spec.ts     seat sync and seat pricing
 *
 * What remains here is only the facade's own behaviour: cancel/resume lifecycle and
 * confirming it actually delegates rather than reimplementing.
 */

function createFacade() {
  const nombaProvider = { verifyWebhookSignature: jest.fn() };
  const billingProviderFactory = {
    cancelExternalSubscription: jest.fn().mockResolvedValue(undefined),
    resumeExternalSubscription: jest.fn().mockResolvedValue(undefined),
    ensureConfigured: jest.fn(),
    getProviderForCountry: jest.fn(() => nombaProvider),
  };
  const subscriptionRepo = { save: jest.fn(async (s) => s), findOne: jest.fn() };
  const subscriptionsService = { getTenantSubscription: jest.fn() };

  const collaborators = {
    webhookDispatcher: {
      handleWebhook: jest.fn(),
      processNombaPayload: jest.fn(),
      processBachsPayload: jest.fn(),
      processPolarPayload: jest.fn(),
      processMonnifyPayload: jest.fn(),
    },
    renewalProcessor: {
      processDueRenewals: jest.fn(),
      lapseStaleSubscriptions: jest.fn(),
      applyRenewalSuccess: jest.fn(),
      markRenewalFailed: jest.fn(),
      buildNombaRenewalOrderReference: jest.fn(),
      renewalPeriodEventId: jest.fn(),
    },
    seatPricing: {
      getTenantSeatCount: jest.fn(),
      syncSubscriptionQuantity: jest.fn(),
    },
    checkoutService: {
      createSubscriptionCheckout: jest.fn(),
      createPaymentMethodUpdateCheckout: jest.fn(),
    },
    overviewService: { getBillingOverview: jest.fn() },
  };

  const service = new SubscriptionBillingService(
    subscriptionsService as never,
    subscriptionRepo as never,
    collaborators.webhookDispatcher as never,
    collaborators.renewalProcessor as never,
    collaborators.seatPricing as never,
    collaborators.checkoutService as never,
    collaborators.overviewService as never,
    billingProviderFactory as never,
  );

  return { service, collaborators, subscriptionsService, subscriptionRepo, billingProviderFactory };
}

describe('SubscriptionBillingService cancellation lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());

  it('schedules cancel at period end by default', async () => {
    const { service, subscriptionsService, subscriptionRepo } = createFacade();
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

  it('cancels the managed external subscription when the user cancels', async () => {
    const { service, subscriptionsService, billingProviderFactory, subscriptionRepo } =
      createFacade();
    subscriptionsService.getTenantSubscription.mockResolvedValue({
      tenantId: 'tenant-1',
      status: SubscriptionStatus.ACTIVE,
      billingProvider: BillingProvider.BACHS,
      externalSubscriptionId: 'sub_bachs_1',
      cancelAtPeriodEnd: false,
    });

    await service.cancelSubscription('tenant-1', { atPeriodEnd: true });

    expect(billingProviderFactory.cancelExternalSubscription).toHaveBeenCalledWith(
      BillingProvider.BACHS,
      'sub_bachs_1',
      true,
    );
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('uncancels the managed provider before clearing cancelAtPeriodEnd', async () => {
    const { service, subscriptionsService, billingProviderFactory, subscriptionRepo } =
      createFacade();
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
    const { service, subscriptionsService } = createFacade();
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
});

describe('SubscriptionBillingService delegation', () => {
  afterEach(() => jest.restoreAllMocks());

  // These guards keep the facade honest: it must delegate, not reimplement.
  it('delegates renewal jobs, seat sync, overview, and checkout to their owners', async () => {
    const { service, collaborators } = createFacade();
    collaborators.renewalProcessor.processDueRenewals.mockResolvedValue({
      charged: 0,
      failed: 0,
      skipped: 0,
      suspended: 0,
    });
    collaborators.overviewService.getBillingOverview.mockResolvedValue({ ownerEmail: null });
    collaborators.seatPricing.getTenantSeatCount.mockResolvedValue(3);

    await service.processDueRenewals();
    await service.syncSubscriptionQuantity('tenant-1');
    await service.getBillingOverview('tenant-1', false);

    expect(collaborators.renewalProcessor.processDueRenewals).toHaveBeenCalled();
    expect(collaborators.seatPricing.syncSubscriptionQuantity).toHaveBeenCalledWith('tenant-1');
    expect(collaborators.overviewService.getBillingOverview).toHaveBeenCalledWith(
      'tenant-1',
      false,
      undefined,
    );
    await expect(service.getTenantSeatCount('tenant-1')).resolves.toBe(3);
  });

  it('routes provider webhooks through the dispatcher with the right provider', async () => {
    const { service, collaborators } = createFacade();
    collaborators.webhookDispatcher.processBachsPayload.mockResolvedValue({ received: true });
    collaborators.webhookDispatcher.processPolarPayload.mockResolvedValue({ received: true });
    collaborators.webhookDispatcher.processMonnifyPayload.mockResolvedValue({ received: true });
    collaborators.webhookDispatcher.processNombaPayload.mockResolvedValue({ received: true });

    await service.processBachsPayload({});
    await service.processPolarPayload({});
    await service.processMonnifyPayload({});
    await service.processNombaPayload({});

    expect(collaborators.webhookDispatcher.processBachsPayload).toHaveBeenCalledWith({});
    expect(collaborators.webhookDispatcher.processPolarPayload).toHaveBeenCalledWith({});
    expect(collaborators.webhookDispatcher.processMonnifyPayload).toHaveBeenCalledWith({});
    expect(collaborators.webhookDispatcher.processNombaPayload).toHaveBeenCalledWith({});
  });
});
