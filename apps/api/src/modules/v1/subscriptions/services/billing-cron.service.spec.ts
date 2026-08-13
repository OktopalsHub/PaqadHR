import { BillingCronService } from './billing-cron.service';
import type { BillingProductSyncService } from './billing-product-sync.service';
import type { SubscriptionBillingService } from './subscription-billing.service';

describe('BillingCronService', () => {
  const originalEnv = {
    NOMBA_CLIENT_ID: process.env.NOMBA_CLIENT_ID,
    NOMBA_CLIENT_SECRET: process.env.NOMBA_CLIENT_SECRET,
    NOMBA_PARENT_ACCOUNT_ID: process.env.NOMBA_PARENT_ACCOUNT_ID,
    MONNIFY_API_KEY: process.env.MONNIFY_API_KEY,
    MONNIFY_SECRET_KEY: process.env.MONNIFY_SECRET_KEY,
    MONNIFY_CONTRACT_CODE: process.env.MONNIFY_CONTRACT_CODE,
    BACHS_SECRET_KEY: process.env.BACHS_SECRET_KEY,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
  };

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
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it('skips renewal processing when billing is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
    delete process.env.BACHS_SECRET_KEY;
    delete process.env.POLAR_ACCESS_TOKEN;
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
