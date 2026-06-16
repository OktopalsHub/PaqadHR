import { BillingCronService } from './billing-cron.service';
import type { SubscriptionBillingService } from './subscription-billing.service';

describe('BillingCronService', () => {
  const originalBillingMode = process.env.BILLING_MODE;
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_ACCOUNT_ID;

  const createService = () => {
    const billingService = {
      processDueRenewals: jest.fn(),
    } as unknown as SubscriptionBillingService;

    const cronService = new BillingCronService(billingService);

    return { cronService, billingService };
  };

  afterEach(() => {
    process.env.BILLING_MODE = originalBillingMode;
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('skips renewal processing when billing gateway is disabled', async () => {
    process.env.BILLING_MODE = 'trial';
    const { cronService, billingService } = createService();

    await cronService.processSubscriptionRenewals();

    expect(billingService.processDueRenewals).not.toHaveBeenCalled();
  });

  it('runs renewal processing when billing gateway is enabled', async () => {
    process.env.BILLING_MODE = 'open';
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_ACCOUNT_ID = 'account-id';

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
