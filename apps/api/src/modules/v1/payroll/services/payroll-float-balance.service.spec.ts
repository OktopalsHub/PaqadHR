import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';

describe('PayrollFloatBalanceService getFincraBalance', () => {
  it('calls /wallets with businessID query param', async () => {
    const request = jest.fn().mockResolvedValue({
      httpStatus: 200,
      parsed: {
        data: [{ currency: 'NGN', availableBalance: 125000 }],
      },
    });
    const fincraAuth = {
      resolveBusinessId: jest.fn().mockResolvedValue('biz-abc'),
      request,
    };
    const service = new PayrollFloatBalanceService({} as never, {} as never, fincraAuth as never);

    const result = await service.getAvailableBalance(PaymentProvider.FINCRA, 'NGN');

    expect(fincraAuth.resolveBusinessId).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith('GET', '/wallets?businessID=biz-abc', undefined, {
      includeBusinessId: true,
    });
    expect(result).toEqual({ supported: true, available: 125000, currency: 'NGN' });
  });
});

describe('PayrollFloatBalanceService getNombaBalance', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NOMBA_SUB_ACCOUNT_ID;
  });

  it('reads parent float from /v1/accounts/balance amount', async () => {
    process.env.NOMBA_CLIENT_ID = 'c';
    process.env.NOMBA_CLIENT_SECRET = 's';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent-1';
    delete process.env.NOMBA_SUB_ACCOUNT_ID;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ code: '00', data: { amount: '10000.5', currency: 'NGN' } }),
    }) as never;

    const nombaAuth = {
      isConfigured: () => true,
      getAccessToken: jest.fn().mockResolvedValue('tok'),
    };
    const service = new PayrollFloatBalanceService(nombaAuth as never, {} as never, {} as never);

    const result = await service.getAvailableBalance(PaymentProvider.NOMBA, 'NGN');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/accounts\/balance$/),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ supported: true, available: 10000.5, currency: 'NGN' });
  });
});
