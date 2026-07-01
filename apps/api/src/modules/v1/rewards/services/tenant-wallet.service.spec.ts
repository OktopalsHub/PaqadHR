import { TenantWalletService } from './tenant-wallet.service';

describe('TenantWalletService provisioning', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  function createService(overrides?: {
    wallet?: Record<string, unknown> | null;
    nombaResult?: Record<string, unknown>;
  }) {
    const wallet = overrides?.wallet ?? {
      id: 'wallet-1',
      tenantId,
      currencyCode: 'NGN',
      balanceAmount: 0,
      virtualAccountNumber: null,
      virtualAccountStatus: null,
    };

    const walletRepo = {
      findOne: jest.fn().mockResolvedValue(wallet),
      create: jest.fn((data) => data),
      save: jest.fn(async (w) => w),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TenantWallet') return walletRepo;
        return {};
      }),
      manager: {},
    };

    const nombaVirtualAccountApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      createVirtualAccount: jest.fn().mockResolvedValue(
        overrides?.nombaResult ?? {
          accountNumber: '9900012345',
          accountName: 'Paqad Test',
          bankName: 'Nomba',
          accountRef: `rewards_wallet_${tenantId}`,
        },
      ),
    };

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: tenantId, name: 'Acme Corp' }),
    };

    const service = new TenantWalletService(
      dataSource as any,
      nombaVirtualAccountApi as any,
      { chargeTokenizedCard: jest.fn(), verifyTransaction: jest.fn(), isConfigured: jest.fn() } as any,
      { getTenantSubscription: jest.fn() } as any,
      { getTenantSettings: jest.fn() } as any,
      tenantRepository as any,
    );

    return { service, walletRepo, nombaVirtualAccountApi };
  }

  it('skips provision when wallet is already ACTIVE', async () => {
    const { service, nombaVirtualAccountApi } = createService({
      wallet: {
        id: 'wallet-1',
        tenantId,
        virtualAccountNumber: '9900012345',
        virtualAccountStatus: 'ACTIVE',
      },
    });

    const result = await service.provisionVirtualAccount(tenantId);
    expect(result.virtualAccountNumber).toBe('9900012345');
    expect(nombaVirtualAccountApi.createVirtualAccount).not.toHaveBeenCalled();
  });

  it('provisions virtual account via Nomba', async () => {
    const { service, nombaVirtualAccountApi } = createService();

    const result = await service.provisionVirtualAccount(tenantId, 'Acme Corp');
    expect(nombaVirtualAccountApi.createVirtualAccount).toHaveBeenCalled();
    expect(result.virtualAccountNumber).toBe('9900012345');
    expect(result.virtualAccountStatus).toBe('ACTIVE');
  });

  it('marks FAILED when Nomba is not configured', async () => {
    const { service, nombaVirtualAccountApi } = createService();
    nombaVirtualAccountApi.isConfigured.mockReturnValue(false);

    const result = await service.provisionVirtualAccount(tenantId);
    expect(result.virtualAccountStatus).toBe('FAILED');
    expect(nombaVirtualAccountApi.createVirtualAccount).not.toHaveBeenCalled();
  });
});
