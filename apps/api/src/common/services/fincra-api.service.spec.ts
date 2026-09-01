import { FincraApiService } from './fincra-api.service';

describe('FincraApiService', () => {
  const env = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...env };
    process.env.FINCRA_PUBLIC_KEY = 'test-key';
    process.env.FINCRA_BUSINESS_ID = 'biz-1';
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterAll(() => {
    process.env = env;
  });

  const service = new FincraApiService();

  const mockFetchResponse = (status: number, body: unknown) => {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    });
  };

  describe('getPayoutStatus', () => {
    it('returns null when Fincra reports resource not found', async () => {
      mockFetchResponse(404, { message: 'RESOURCE_NOT_FOUND' });

      const result = await service.getPayoutStatus('payroll_run_item');

      expect(result).toBeNull();
    });

    it('throws on ambiguous lookup failures instead of treating as not found', async () => {
      mockFetchResponse(503, { message: 'upstream unavailable' });

      await expect(service.getPayoutStatus('payroll_run_item')).rejects.toThrow(
        'Fincra payout status lookup failed',
      );
    });
  });

  describe('initiatePayout', () => {
    it('does not POST when preflight lookup fails with a non-not-found error', async () => {
      mockFetchResponse(503, { message: 'upstream unavailable' });

      await expect(
        service.initiatePayout({
          amount: 1000,
          destinationCurrency: 'NGN',
          customerReference: 'payroll_run_item',
          accountNumber: '0123456789',
          accountName: 'Jane Doe',
          bankCode: '044',
        }),
      ).rejects.toThrow('Fincra payout status lookup failed');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/customer-reference/');
    });

    it('reuses an in-flight payout from preflight lookup without POSTing again', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: {
              status: 'processing',
              reference: 'fincra-ref-existing',
            },
          }),
      });

      const result = await service.initiatePayout({
        amount: 1000,
        destinationCurrency: 'NGN',
        customerReference: 'payroll_run_item',
        accountNumber: '0123456789',
        accountName: 'Jane Doe',
        bankCode: '044',
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          reference: 'fincra-ref-existing',
          status: 'PROCESSING',
        }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not POST when preflight finds a failed payout on the same customer reference', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: {
              status: 'failed',
              reference: 'fincra-ref-failed',
            },
          }),
      });

      const result = await service.initiatePayout({
        amount: 1000,
        destinationCurrency: 'NGN',
        customerReference: 'payroll_run_item',
        accountNumber: '0123456789',
        accountName: 'Jane Doe',
        bankCode: '044',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed payout');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveBusinessId', () => {
    it('fetches business _id from profile when FINCRA_BUSINESS_ID is unset', async () => {
      delete process.env.FINCRA_BUSINESS_ID;
      mockFetchResponse(200, {
        success: true,
        data: { _id: 'profile-biz-id', country: 'NG' },
      });

      const id = await service.resolveBusinessId();

      expect(id).toBe('profile-biz-id');
      expect(fetchMock.mock.calls[0][0]).toContain('/profile/business/me');
    });
  });
});
