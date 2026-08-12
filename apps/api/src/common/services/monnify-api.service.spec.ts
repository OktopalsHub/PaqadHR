import { ServiceUnavailableException } from '@nestjs/common';
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
});
