import { PayrollPayoutCronService } from './payroll-payout-cron.service';
import type { PayrollPayoutService } from './payroll-payout.service';

describe('PayrollPayoutCronService', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_ACCOUNT_ID;

  const createService = () => {
    const payrollPayoutService = {
      requeryStuckPayouts: jest.fn(),
    } as unknown as PayrollPayoutService;

    const cronService = new PayrollPayoutCronService(payrollPayoutService);

    return { cronService, payrollPayoutService };
  };

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('skips requery when Nomba is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_ACCOUNT_ID;
    const { cronService, payrollPayoutService } = createService();

    await cronService.requeryStuckPayouts();

    expect(payrollPayoutService.requeryStuckPayouts).not.toHaveBeenCalled();
  });

  it('requeries stuck payouts when Nomba is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_ACCOUNT_ID = 'account-id';

    const { cronService, payrollPayoutService } = createService();
    (payrollPayoutService.requeryStuckPayouts as jest.Mock).mockResolvedValue({
      checked: 2,
      updated: 1,
    });

    await cronService.requeryStuckPayouts();

    expect(payrollPayoutService.requeryStuckPayouts).toHaveBeenCalledTimes(1);
  });
});
