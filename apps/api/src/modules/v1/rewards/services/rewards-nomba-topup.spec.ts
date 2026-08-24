import { DataSource } from 'typeorm';
import { RewardsService } from './rewards.service';

describe('RewardsService Nomba topup', () => {
  let service: RewardsService;
  let purchaseAirtime: jest.Mock;
  let purchaseDataBundle: jest.Mock;
  let listDataPlans: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate from .env so provider routing resolves to Nomba deterministically.
    process.env = { ...originalEnv };
    delete process.env.NG_REWARDS_AIRTIME_PROVIDER;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
    purchaseAirtime = jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'tx-airtime',
      status: 'SUCCESS',
    });
    purchaseDataBundle = jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'tx-data',
      status: 'SUCCESS',
    });
    listDataPlans = jest.fn().mockResolvedValue([
      { amount: 1000, plan: '1GB' },
      { amount: 2000, plan: '2GB' },
    ]);

    // Positional args: index 0 = dataSource, index 6 = nombaBillApi,
    // index 7 = monnifyBillApi.
    const ctorArgs: any[] = Array(15).fill({});
    ctorArgs[0] = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn(),
        update: jest.fn(),
      })),
    } as unknown as DataSource;
    ctorArgs[6] = {
      isConfigured: jest.fn().mockReturnValue(true),
      purchaseAirtime,
      purchaseDataBundle,
      listDataPlans,
    };
    ctorArgs[7] = {
      isConfigured: jest.fn().mockReturnValue(false),
      purchaseAirtime: jest.fn(),
      purchaseDataBundle: jest.fn(),
      listDataPlans: jest.fn(),
    };
    service = new RewardsService(...(ctorArgs as ConstructorParameters<typeof RewardsService>));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('lists Nomba data plans for a network', async () => {
    const plans = await service.listNombaDataPlans('MTN');
    expect(plans).toEqual([
      { amount: 1000, plan: '1GB' },
      { amount: 2000, plan: '2GB' },
    ]);
    expect(listDataPlans).toHaveBeenCalledWith('MTN');
  });

  it('rejects NGN airtime claims when the routed bill provider is not configured', () => {
    // Route to the deliberately-unconfigured Monnify client for this assertion.
    process.env.NG_REWARDS_AIRTIME_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    expect(() =>
      (service as any).assertNgNombaRouting(
        {
          rewardType: 'NOMBA_AIRTIME',
          currencyCode: 'NGN',
          currencyValue: 1000,
          pointsCost: 1020,
          rewardId: 'NOMBA_AIRTIME',
          recipientPhone: '08021234567',
          airtimeNetwork: 'MTN',
        },
        { rewardsCurrency: 'NGN' },
      ),
    ).toThrow(/temporarily unavailable/);
  });
});

describe('RewardsService provider-pending topups', () => {
  const originalEnv = process.env;
  let updateMock: jest.Mock;
  let purchaseAirtime: jest.Mock;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NG_REWARDS_AIRTIME_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeService(purchaseResult: {
    success: boolean;
    transactionId: string | null;
    status: string;
  }): RewardsService {
    updateMock = jest.fn().mockResolvedValue({});
    purchaseAirtime = jest.fn().mockResolvedValue(purchaseResult);
    const dataSource = {
      getRepository: jest.fn(() => ({ update: updateMock })),
    } as unknown as DataSource;

    // Positional args: index 6 = nombaBillApi, index 7 = monnifyBillApi.
    const ctorArgs: any[] = Array(15).fill({});
    ctorArgs[0] = dataSource;
    ctorArgs[6] = { isConfigured: () => false };
    ctorArgs[7] = {
      isConfigured: () => true,
      purchaseAirtime,
      purchaseDataBundle: jest.fn(),
      listDataPlans: jest.fn(),
    };
    return new RewardsService(...(ctorArgs as ConstructorParameters<typeof RewardsService>));
  }

  const redemption = {
    id: 'redemption-9',
    tenantId: 'tenant-1',
    memberId: 'member-1',
    currencyValue: 500,
    currencyCode: 'NGN',
    providerRef: {},
  } as any;

  const claimInput = {
    rewardType: 'NOMBA_AIRTIME',
    recipientPhone: '08021234567',
    airtimeNetwork: 'AIRTEL',
  } as any;

  it('keeps a provider-pending vend in PROCESSING with a fresh recovery lease', async () => {
    const service = makeService({ success: false, transactionId: 'mfy-9', status: 'PENDING' });

    await (service as any).fulfillNombaTopup(redemption, claimInput);

    expect(updateMock).toHaveBeenCalledWith(
      'redemption-9',
      expect.objectContaining({
        status: 'PROCESSING',
        processingStartedAt: expect.any(Function),
      }),
    );
  });

  it('throws for a confirmed failed vend so the caller refunds instead', async () => {
    const service = makeService({ success: false, transactionId: null, status: 'FAILED' });

    await expect((service as any).fulfillNombaTopup(redemption, claimInput)).rejects.toThrow(
      /purchase failed: status FAILED/i,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('passes the selected plan code through to the provider for data bundles', async () => {
    updateMock = jest.fn().mockResolvedValue({});
    const purchaseDataBundle = jest
      .fn()
      .mockResolvedValue({ success: true, transactionId: 'tx-data', status: 'SUCCESS' });
    const dataSource = {
      getRepository: jest.fn(() => ({ update: updateMock })),
    } as unknown as DataSource;
    const ctorArgs: any[] = Array(15).fill({});
    ctorArgs[0] = dataSource;
    ctorArgs[6] = { isConfigured: () => false };
    ctorArgs[7] = {
      isConfigured: () => true,
      purchaseAirtime: jest.fn(),
      purchaseDataBundle,
      listDataPlans: jest.fn(),
    };
    const service = new RewardsService(
      ...(ctorArgs as ConstructorParameters<typeof RewardsService>),
    );

    await (service as any).fulfillNombaTopup(redemption, {
      ...claimInput,
      topupKind: 'data',
      dataPlanCode: '19882',
    });

    expect(purchaseDataBundle).toHaveBeenCalledWith(
      expect.objectContaining({ productCode: '19882', merchantTxRef: 'redemption-9' }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      'redemption-9',
      expect.objectContaining({ status: 'SUCCESS' }),
    );
  });
});
