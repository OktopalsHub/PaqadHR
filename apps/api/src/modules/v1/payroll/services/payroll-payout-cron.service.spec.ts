import type { PayrollService } from './payroll.service';
import type { PayrollPayoutService } from './payroll-payout.service';
import { PayrollPayoutCronService } from './payroll-payout-cron.service';

describe('PayrollPayoutCronService', () => {
  const originalEnv = {
    NOMBA_CLIENT_ID: process.env.NOMBA_CLIENT_ID,
    NOMBA_CLIENT_SECRET: process.env.NOMBA_CLIENT_SECRET,
    NOMBA_PARENT_ACCOUNT_ID: process.env.NOMBA_PARENT_ACCOUNT_ID,
    MONNIFY_API_KEY: process.env.MONNIFY_API_KEY,
    MONNIFY_SECRET_KEY: process.env.MONNIFY_SECRET_KEY,
    MONNIFY_CONTRACT_CODE: process.env.MONNIFY_CONTRACT_CODE,
    NOAH_API_KEY: process.env.NOAH_API_KEY,
  };

  const createService = () => {
    const payrollPayoutService = {
      requeryStuckPayouts: jest.fn(),
    } as unknown as PayrollPayoutService;
    const payrollService = {
      processDueScheduledPayouts: jest.fn(),
    } as unknown as PayrollService;

    const cronService = new PayrollPayoutCronService(payrollPayoutService, payrollService);

    return { cronService, payrollPayoutService, payrollService };
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it('skips requery when payroll gateway is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
    delete process.env.NOAH_API_KEY;
    const { cronService, payrollPayoutService } = createService();

    await cronService.requeryStuckPayouts();

    expect(payrollPayoutService.requeryStuckPayouts).not.toHaveBeenCalled();
  });

  it('requeries stuck payouts when Nomba is configured', async () => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';

    const { cronService, payrollPayoutService } = createService();
    (payrollPayoutService.requeryStuckPayouts as jest.Mock).mockResolvedValue({
      checked: 2,
      updated: 1,
    });

    await cronService.requeryStuckPayouts();

    expect(payrollPayoutService.requeryStuckPayouts).toHaveBeenCalledTimes(1);
  });
});
