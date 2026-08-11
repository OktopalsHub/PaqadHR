import { BillingCronService } from './billing-cron.service';
import type { BillingProductSyncService } from './billing-product-sync.service';
import type { SubscriptionBillingService } from './subscription-billing.service';

describe('BillingCronService', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;

  const createService = () => {
    const billingService = {
      processDueRenewals: jest.fn(),
      reconcileStaleManagedSubscriptions: jest.fn(),
      lapseStaleSubscriptions: jest.fn(),
      lapseStaleBachsSubscriptions: jest.fn(),
    } as unknown as SubscriptionBillingService;
    const productSync = {
      healMissingProductIds: jest.fn(),
    } as unknown as BillingProductSyncService;

    const cronService = new BillingCronService(billingService, productSync);

    return { cronService, billingService, productSync };
  };

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('skips renewal processing when Nomba is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    const { cronService, billingService } = createService();

    await cronService.processSubscriptionRenewals();

    expect(billingService.processDueRenewals).not.toHaveBeenCalled();
  });

  it('runs renewal processing when Nomba is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';

    const { cronService, billingService } = createService();
    (billingService.processDueRenewals as jest.Mock).mockResolvedValue({
      charged: 1,
      failed: 0,
      skipped: 0,
      suspended: 0,
    });

    await cronService.processSubscriptionRenewals();

    expect(billingService.processDueRenewals).toHaveBeenCalledTimes(1);
  });

  it('reconciles stale managed subscriptions when billing is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';

    const { cronService, billingService } = createService();
    (billingService.reconcileStaleManagedSubscriptions as jest.Mock).mockResolvedValue({
      synced: 2,
      failed: 0,
    });

    await cronService.syncManagedSubscriptions();

    expect(billingService.reconcileStaleManagedSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('lapses stale subscriptions when billing is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';

    const { cronService, billingService } = createService();
    (billingService.lapseStaleSubscriptions as jest.Mock).mockResolvedValue({ lapsed: 1 });

    await cronService.lapseStaleSubscriptions();

    expect(billingService.lapseStaleSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('heals missing billing product IDs when billing is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';

    const { cronService, productSync } = createService();
    (productSync.healMissingProductIds as jest.Mock).mockResolvedValue({
      bachsUpdated: 1,
      polarUpdated: 0,
    });

    await cronService.healMissingBillingProducts();

    expect(productSync.healMissingProductIds).toHaveBeenCalledTimes(1);
  });
});
