import { MonnifyApiService } from './monnify-api.service';
import { MonnifyBillApiService } from './monnify-bill-api.service';

describe('MonnifyBillApiService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;
  let monnifyApi: MonnifyApiService;

  const okBody = (responseBody: unknown) => ({
    ok: true,
    json: async () => ({ requestSuccessful: true, responseBody }),
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MONNIFY_API_KEY: 'key',
      MONNIFY_SECRET_KEY: 'secret',
      MONNIFY_CONTRACT_CODE: 'contract',
      MONNIFY_BASE_URL: 'https://sandbox.monnify.com',
    };
    MonnifyBillApiService.VEND_POLL_ATTEMPTS = 3;
    MonnifyBillApiService.VEND_POLL_DELAY_MS = 0;
    monnifyApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    } as unknown as MonnifyApiService;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('validates then vends airtime with a normalized phone number', async () => {
    const service = new MonnifyBillApiService(monnifyApi);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ code: 'MTN_AIRTIME', name: 'MTN' }]))
      .mockResolvedValueOnce(okBody([{ code: 'MTN_VTU', name: 'MTN Airtime' }]))
      .mockResolvedValueOnce(okBody({ requireValidationRef: true, validationReference: 'val-1' }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-1',
          vendReference: 'redemption-1',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

    await expect(
      service.purchaseAirtime({
        amount: 500,
        phoneNumber: '08012345678',
        network: 'MTN',
        merchantTxRef: 'redemption-1',
      }),
    ).resolves.toEqual({ success: true, transactionId: 'mfy-tx-1', status: 'SUCCESS' });

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

  it('uses DATA_BUNDLE rather than a generic DATA category for telco plans', async () => {
    const service = new MonnifyBillApiService(monnifyApi);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        okBody([
          { categoryCode: 'DATA', categoryName: 'Internet Data' },
          { categoryCode: 'DATA_BUNDLE', categoryName: 'Data Bundles' },
        ]),
      )
      .mockResolvedValueOnce(okBody([{ code: 'MTN_DATA_BUNDLE', name: 'MTN Data Bundles' }]))
      .mockResolvedValueOnce(
        okBody([{ price: 500, name: '1GB', code: 'MTN_1GB' }]),
      ) as unknown as typeof fetch;

    await expect(service.listDataPlans('MTN')).resolves.toEqual([
      { amount: 500, plan: '1GB', productCode: 'MTN_1GB' },
    ]);
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain(
      'category_code=DATA_BUNDLE',
    );
  });

  it('rejects an unavailable selected plan code instead of substituting a same-priced plan', async () => {
    const service = new MonnifyBillApiService(monnifyApi);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        okBody([{ categoryCode: 'DATA_BUNDLE', categoryName: 'Data Bundles' }]),
      )
      .mockResolvedValueOnce(okBody([{ code: 'MTN_DATA_BUNDLE', name: 'MTN Data Bundles' }]))
      .mockResolvedValueOnce(
        okBody([{ price: 500, name: '1GB', code: 'MTN_1GB' }]),
      ) as unknown as typeof fetch;

    await expect(
      service.purchaseDataBundle({
        amount: 500,
        phoneNumber: '08012345678',
        network: 'MTN',
        merchantTxRef: 'redemption-1',
        dataPlanCode: 'MTN_2GB',
      }),
    ).rejects.toThrow('the selected data plan is no longer available');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('times out a Monnify request that never settles', async () => {
    const service = new MonnifyBillApiService(monnifyApi);
    const controller = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
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
  });

  it('requeries a pending vend until it receives a terminal result', async () => {
    const service = new MonnifyBillApiService(monnifyApi);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ code: 'AIRTEL_AIRTIME', name: 'Airtel' }]))
      .mockResolvedValueOnce(okBody([{ code: 'AIRTEL_VTU', name: 'Airtel Airtime' }]))
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(okBody({ vendReference: 'redemption-2', vendStatus: 'PENDING' }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-2',
          vendReference: 'redemption-2',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

    await expect(
      service.purchaseAirtime({
        amount: 300,
        phoneNumber: '+2347012345678',
        network: 'AIRTEL',
        merchantTxRef: 'redemption-2',
      }),
    ).resolves.toEqual({ success: true, transactionId: 'mfy-tx-2', status: 'SUCCESS' });
  });
});
