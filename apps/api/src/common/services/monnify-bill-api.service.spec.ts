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
      customerId: '08012345678',
      vendAmount: 500,
      vendReference: 'redemption-1',
      validationReference: 'val-1',
    });
    // validate was called with same local id
    const validateCall = (global.fetch as jest.Mock).mock.calls[3];
    expect(JSON.parse(validateCall[1].body)).toMatchObject({
      customerId: '08012345678',
    });
  });

  it('validates then vends airtime for Airtel network', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
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
      customerId: '07012345678',
      vendAmount: 300,
      vendReference: 'redemption-2',
    });
  });

  it('normalizes phone numbers with various formats', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
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
      customerId: '08012345678',
    });
  });

  it('retries with intl format when local validation returns invalid customerId', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      // discovery
      .mockResolvedValueOnce(okBody([{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }]))
      .mockResolvedValueOnce(okBody([{ billerCode: 'MTN_AIRTIME', name: 'MTN' }]))
      .mockResolvedValueOnce(okBody([{ productCode: 'MTN_VTU', name: 'MTN Airtime' }]))
      // first validate -> invalid customerId
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          requestSuccessful: false,
          responseMessage: 'invalid customerId',
        }),
      } as unknown as Response)
      // retry validate with 234 -> success
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(
        okBody({
          transactionReference: 'mfy-tx-retry',
          vendReference: 'redemption-retry',
          vendStatus: 'SUCCESS',
        }),
      ) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 500,
      phoneNumber: '08012345678',
      network: 'MTN',
      merchantTxRef: 'redemption-retry',
    });

    expect(result).toEqual({
      success: true,
      transactionId: 'mfy-tx-retry',
      status: 'SUCCESS',
    });

    const firstValidate = JSON.parse((global.fetch as jest.Mock).mock.calls[3][1].body);
    expect(firstValidate.customerId).toBe('08012345678');
    const secondValidate = JSON.parse((global.fetch as jest.Mock).mock.calls[4][1].body);
    expect(secondValidate.customerId).toBe('2348012345678');
  });
});
