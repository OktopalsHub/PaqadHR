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
    const service = new PayrollFloatBalanceService(
      {} as never,
      {} as never,
      fincraAuth as never,
    );

    const result = await service.getAvailableBalance(PaymentProvider.FINCRA, 'NGN');

    expect(fincraAuth.resolveBusinessId).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      'GET',
      '/wallets?businessID=biz-abc',
      undefined,
      { includeBusinessId: true },
    );
    expect(result).toEqual({ supported: true, available: 125000, currency: 'NGN' });
  });
});
