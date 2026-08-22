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

  it('discovers billers and products using the live sandbox contract, then validates and vends', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      // billers: real sandbox shape is { code, name } inside a paginated content[]
      .mockResolvedValueOnce(
        okBody({
          content: [
            { code: 'AIRTEL', name: 'AIRTEL' },
            { code: 'GLO', name: 'GLO' },
            { code: 'MTN', name: 'MTN' },
            { code: '9MOBILE', name: '9MOBILE' },
          ],
          totalElements: 4,
        }),
      )
      // products: real sandbox shape is { code, name, price, category }
      .mockResolvedValueOnce(
        okBody({
          content: [
            {
              code: '13',
              name: 'MTN Mobile Top up',
              priceType: 'OPEN',
              category: { code: 'AIRTIME', name: 'AIRTIME' },
            },
          ],
          totalElements: 1,
        }),
      )
      .mockResolvedValueOnce(
        okBody({
          vendInstruction: { requireValidationRef: true, validationReference: 'val-1' },
        }),
      )
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

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[0][0])).toContain('/api/v1/vas/bills-payment/billers?');
    expect(String(calls[0][0])).toContain('category_code=AIRTIME');
    expect(String(calls[1][0])).toContain('/api/v1/vas/bills-payment/biller-products?');
    expect(String(calls[1][0])).toContain('biller_code=MTN');
    expect(String(calls[3][0])).toContain('/api/v1/vas/bills-payment/vend');
    expect(JSON.parse(calls[3][1].body)).toMatchObject({
      productCode: '13',
      customerId: '08012345678',
      vendAmount: 500,
      vendReference: 'redemption-1',
      validationReference: 'val-1',
    });
  });

  it('lists the billers that were returned when no network matches, for diagnosis', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest.fn().mockResolvedValue(
      okBody({
        content: [
          { code: 'AIRTEL', name: 'AIRTEL' },
          { code: 'GLO', name: 'GLO' },
        ],
      }),
    ) as unknown as typeof fetch;

    await expect(
      service.purchaseAirtime({
        amount: 500,
        phoneNumber: '08012345678',
        network: 'MTN',
        merchantTxRef: 'redemption-1',
      }),
    ).rejects.toThrow(/no airtime biller for MTN .*AIRTEL \(AIRTEL\), GLO \(GLO\)/);
  });

  it('polls requery when a vend comes back IN_PROGRESS until it succeeds', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody({ content: [{ code: 'MTN', name: 'MTN' }] }))
      .mockResolvedValueOnce(
        okBody({
          content: [
            {
              code: '13',
              name: 'MTN Mobile Top up',
              category: { code: 'AIRTIME', name: 'AIRTIME' },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okBody({ vendInstruction: { requireValidationRef: false } }))
      .mockResolvedValueOnce(okBody({ vendStatus: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(okBody({ vendStatus: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(
        okBody({ transactionReference: 'mfy-tx-2', vendStatus: 'SUCCESS' }),
      ) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 100,
      phoneNumber: '08012345678',
      network: 'MTN',
      merchantTxRef: 'redemption-2',
    });

    expect(result).toEqual({ success: true, transactionId: 'mfy-tx-2', status: 'SUCCESS' });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[4][0])).toContain(
      '/api/v1/vas/bills-payment/requery?reference=redemption-2',
    );
    expect(String(calls[5][0])).toContain(
      '/api/v1/vas/bills-payment/requery?reference=redemption-2',
    );
  });

  it('reports PENDING when the vend never reaches a terminal state', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody({ content: [{ code: 'MTN', name: 'MTN' }] }))
      .mockResolvedValueOnce(
        okBody({
          content: [
            {
              code: '13',
              name: 'MTN Mobile Top up',
              category: { code: 'AIRTIME', name: 'AIRTIME' },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      // initial vend + every requery stays IN_PROGRESS
      .mockResolvedValue(okBody({ vendStatus: 'IN_PROGRESS' })) as unknown as typeof fetch;

    const result = await service.purchaseAirtime({
      amount: 100,
      phoneNumber: '08012345678',
      network: 'MTN',
      merchantTxRef: 'redemption-3',
    });

    expect(result).toEqual({ success: false, transactionId: null, status: 'PENDING' });
  });

  it('resolves telco data bundles from the DATA_BUNDLE category by fixed price', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        okBody({
          content: [{ code: 'GLO', name: 'GLO' }],
        }),
      )
      .mockResolvedValueOnce(
        okBody({
          content: [
            {
              code: '19875',
              name: 'N500_Oneoff 1.55GB (7 Days)',
              price: 650,
              priceType: 'FIXED',
              category: { code: 'DATA_BUNDLE', name: 'DATA_BUNDLE' },
            },
            {
              code: '19882',
              name: 'Camp-Boost_200_Oneoff 525MB (2 Days)',
              price: 260,
              priceType: 'FIXED',
              category: { code: 'DATA_BUNDLE', name: 'DATA_BUNDLE' },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(
        okBody({ transactionReference: 'mfy-tx-3', vendStatus: 'SUCCESS' }),
      ) as unknown as typeof fetch;

    const result = await service.purchaseDataBundle({
      amount: 260,
      phoneNumber: '08012345678',
      network: 'GLO',
      merchantTxRef: 'redemption-3',
    });

    expect(result.success).toBe(true);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[0][0])).toContain('category_code=DATA_BUNDLE');
    expect(JSON.parse(calls[3][1].body)).toMatchObject({ productCode: '19882' });
  });

  it('vends the exact selected data bundle when plans share a price', async () => {
    const service = new MonnifyBillApiService(monnifyApi);

    const duplicatedPricePlans = [
      {
        code: '19875',
        name: 'N500_Oneoff 1.55GB (7 Days)',
        price: 260,
        priceType: 'FIXED',
        category: { code: 'DATA_BUNDLE', name: 'DATA_BUNDLE' },
      },
      {
        code: '19882',
        name: 'Camp-Boost_200_Oneoff 525MB (2 Days)',
        price: 260,
        priceType: 'FIXED',
        category: { code: 'DATA_BUNDLE', name: 'DATA_BUNDLE' },
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okBody({ content: [{ code: 'GLO', name: 'GLO' }] }))
      .mockResolvedValueOnce(okBody({ content: duplicatedPricePlans }))
      .mockResolvedValueOnce(okBody({ requireValidationRef: false }))
      .mockResolvedValueOnce(
        okBody({ transactionReference: 'mfy-tx-4', vendStatus: 'SUCCESS' }),
      ) as unknown as typeof fetch;

    // User picked Camp-Boost (19882); both plans cost 260, so the code must decide.
    await service.purchaseDataBundle({
      amount: 260,
      phoneNumber: '08012345678',
      network: 'GLO',
      merchantTxRef: 'redemption-4',
      productCode: '19882',
    });

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(JSON.parse(calls[3][1].body)).toMatchObject({ productCode: '19882' });
  });
});
