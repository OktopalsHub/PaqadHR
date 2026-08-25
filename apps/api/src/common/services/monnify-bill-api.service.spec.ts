import { MonnifyApiService } from './monnify-api.service';
import { MonnifyBillApiService } from './monnify-bill-api.service';

describe('MonnifyBillApiService', () => {
  const originalFetch = global.fetch;
  const env = process.env;
  let monnifyApi: MonnifyApiService;

  beforeEach(() => {
    process.env = { ...env };
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.MONNIFY_BASE_URL = 'https://sandbox.monnify.com';
    MonnifyBillApiService.VEND_POLL_ATTEMPTS = 3;
    MonnifyBillApiService.VEND_POLL_DELAY_MS = 0;
    monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = env;
  });

  const okBody = (responseBody: unknown) => ({
    ok: true,
    json: async () => ({ requestSuccessful: true, responseBody }),
  });

  it('validates then vends airtime for a matched network product', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ billerCode: 'MTN_AIRTIME', name: 'MTN' }]))
      .mockResolvedValueOnce(okBody([{ productCode: 'MTN_VTU', name: 'MTN Airtime' }]))
      .mockResolvedValueOnce(okBody({ requireValidationRef: true, validationReference: 'val-1' }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-1',
          vendReference: 'redemption-1',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

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

    const vendCall = (global.fetch as jest.Mock).mock.calls[4];
    expect(String(vendCall[0])).toContain('/api/v1/vas/bills-payment/vend');
    expect(JSON.parse(vendCall[1].body)).toMatchObject({
      productCode: 'MTN_VTU',
      customerId: '2348012345678',
      vendAmount: 500,
      vendReference: 'redemption-1',
      validationReference: 'val-1',
    });
  });

<<<<<<< HEAD
  it('uses DATA_BUNDLE rather than the generic DATA category for telco plans', async () => {
    const monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
=======
  it('validates then vends airtime for Airtel network', async () => {
>>>>>>> 4001bab50871e992a8803610b829a6ef79b7a3e9
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
<<<<<<< HEAD
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
=======
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ billerCode: 'AIRTEL_AIRTIME', name: 'Airtel' }]))
      .mockResolvedValueOnce(okBody([{ productCode: 'AIRTEL_VTU', name: 'Airtel Airtime' }]))
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-2',
          vendReference: 'redemption-2',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 300,
      phoneNumber: '07012345678',
      network: 'AIRTEL',
      merchantTxRef: 'redemption-2',
    });

    expect(result).toEqual({
      success: true,
      transactionId: 'mfy-tx-2',
      status: 'SUCCESS',
    });

    const vendCall = (global.fetch as jest.Mock).mock.calls[4];
    expect(String(vendCall[0])).toContain('/api/v1/vas/bills-payment/vend');
    expect(JSON.parse(vendCall[1].body)).toMatchObject({
      productCode: 'AIRTEL_VTU',
      customerId: '2347012345678',
      vendAmount: 300,
      vendReference: 'redemption-2',
    });
  });

  it('normalizes phone numbers with various formats', async () => {
>>>>>>> 4001bab50871e992a8803610b829a6ef79b7a3e9
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
<<<<<<< HEAD
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
=======
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ billerCode: 'MTN_AIRTIME', name: 'MTN' }]))
      .mockResolvedValueOnce(okBody([{ productCode: 'MTN_VTU', name: 'MTN Airtime' }]))
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-3',
          vendReference: 'redemption-3',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 100,
      phoneNumber: '+2348012345678',
      network: 'MTN',
      merchantTxRef: 'redemption-3',
    });

    expect(result).toEqual({
      success: true,
      transactionId: 'mfy-tx-3',
      status: 'SUCCESS',
    });

    const vendCall = (global.fetch as jest.Mock).mock.calls[4];
    expect(String(vendCall[0])).toContain('/api/v1/vas/bills-payment/vend');
    expect(JSON.parse(vendCall[1].body)).toMatchObject({
      customerId: '2348012345678',
    });
>>>>>>> 4001bab50871e992a8803610b829a6ef79b7a3e9
  });
});
