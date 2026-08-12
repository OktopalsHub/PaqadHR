import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MonnifyApiService } from './monnify-api.service';

describe('MonnifyApiService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('maps fetch timeouts to a service-unavailable checkout error', async () => {
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      }),
    );

    const service = new MonnifyApiService();

    await expect(
      service.initializeTransaction({
        amount: 5000,
        customerName: 'Test',
        customerEmail: 'test@example.com',
        paymentReference: 'wm_test_ref',
        paymentDescription: 'Rewards wallet top-up',
        redirectUrl: 'https://app.example/settings',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('logs Monnify response diagnostics when checkout init returns no checkout URL', async () => {
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          requestSuccessful: true,
          responseBody: { accessToken: 'token', expiresIn: 3600 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({
          requestSuccessful: false,
          responseCode: '99',
          responseMessage: 'Gateway timeout',
        }),
      });

    const service = new MonnifyApiService();
    const warnSpy = jest.spyOn(service['logger'], 'warn');

    await expect(
      service.initializeTransaction({
        amount: 5000,
        customerName: 'Test',
        customerEmail: 'test@example.com',
        paymentReference: 'wm_test_ref',
        paymentDescription: 'Rewards wallet top-up',
        redirectUrl: 'https://app.example/settings',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('checkout-init /api/v1/merchant/transactions/init-transaction'),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('http=504'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('responseMessage=Gateway timeout'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('paymentReference=wm_test_ref'));
  });
});
