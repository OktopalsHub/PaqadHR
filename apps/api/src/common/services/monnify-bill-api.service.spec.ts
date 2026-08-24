import { MonnifyApiService } from './monnify-api.service';
import { MonnifyBillApiService } from './monnify-bill-api.service';

describe('MonnifyBillApiService', () => {
  const originalFetch = global.fetch;
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.MONNIFY_BASE_URL = 'https://sandbox.monnify.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = env;
  });

  it('validates then vends airtime for a matched network product', async () => {
    const monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'MTN_AIRTIME', name: 'MTN Nigeria' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ productCode: 'MTN_VTU', name: 'MTN Airtime' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: { requireValidationRef: true, validationReference: 'val-1' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: {
            transactionReference: 'mfy-tx-1',
            vendReference: 'redemption-1',
            vendStatus: 'SUCCESS',
          },
        }),
      }) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 500,
      phoneNumber: '08012345678',
      network: 'MTN',
      merchantTxRef: 'redemption-1',
    });

    expect(result).toEqual({
      success: true,
      transactionId: 'mfy-tx-1',
      status: 'SUCCESS',
    });

    const vendCall = (global.fetch as jest.Mock).mock.calls[3];
    expect(String(vendCall[0])).toContain('/api/v1/vas/bills-payment/vend');
    expect(JSON.parse(vendCall[1].body)).toMatchObject({
      productCode: 'MTN_VTU',
      customerId: '08012345678',
      vendAmount: 500,
      vendReference: 'redemption-1',
      validationReference: 'val-1',
    });
  });

  it('uses DATA_BUNDLE rather than the generic DATA category for telco plans', async () => {
    const monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'MTN_DATA_BUNDLE', name: 'MTN Data Bundles' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ amount: 500, name: '1GB', productCode: 'MTN_1GB' }],
        }),
      }) as unknown as typeof fetch;

    await expect(service.listDataPlans('MTN')).resolves.toEqual([
      { amount: 500, plan: '1GB', productCode: 'MTN_1GB' },
    ]);

    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'category_code=DATA_BUNDLE',
    );
  });

  it('rejects an unavailable selected data-plan code instead of using a same-priced plan', async () => {
    const monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'MTN_DATA_BUNDLE', name: 'MTN Data Bundles' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ amount: 500, name: '1GB', productCode: 'MTN_1GB' }],
        }),
      }) as unknown as typeof fetch;

    await expect(
      service.purchaseDataBundle({
        amount: 500,
        phoneNumber: '08012345678',
        network: 'MTN',
        merchantTxRef: 'redemption-1',
        dataPlanCode: 'MTN_2GB',
      }),
    ).rejects.toThrow('the selected data plan is no longer available');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('times out a Monnify request that never settles', async () => {
    const monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
    const service = new MonnifyBillApiService(monnifyApi);
    const controller = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);

    global.fetch = jest.fn(
      (_url, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('request timed out');
            error.name = 'TimeoutError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    const request = service.listDataPlans('MTN');
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toThrow('Monnify billing service timed out');
    timeout.mockRestore();
  });
});
