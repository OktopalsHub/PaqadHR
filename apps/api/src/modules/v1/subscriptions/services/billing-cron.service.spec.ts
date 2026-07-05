import { BillingCronService } from './billing-cron.service';
import type { SubscriptionBillingService } from './subscription-billing.service';

describe('BillingCronService', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;

  const createService = () => {
    const billingService = {
      processDueRenewals: jest.fn(),
    } as unknown as SubscriptionBillingService;

    const cronService = new BillingCronService(billingService);

    return { cronService, billingService };
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
});
