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
          responseBody: [{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'MTN_AIRTIME', name: 'MTN' }],
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

  it('validates then vends airtime for Airtel network', async () => {
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
          responseBody: [{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'AIRTEL_AIRTIME', name: 'Airtel' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ productCode: 'AIRTEL_VTU', name: 'Airtel Airtime' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: { requireValidationRef: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: {
            transactionReference: 'mfy-tx-2',
            vendReference: 'redemption-2',
            vendStatus: 'SUCCESS',
          },
        }),
      }) as unknown as typeof fetch;

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
          responseBody: [{ categoryCode: 'AIRTIME', categoryName: 'Airtime' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: [{ billerCode: 'MTN_AIRTIME', name: 'MTN' }],
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
          responseBody: { requireValidationRef: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: {
            transactionReference: 'mfy-tx-3',
            vendReference: 'redemption-3',
            vendStatus: 'SUCCESS',
          },
        }),
      }) as unknown as typeof fetch;

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
  });
});
