import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import type { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletVirtualAccountService } from './tenant-wallet-virtual-account.service';

describe('TenantWalletVirtualAccountService.describeVirtualAccount', () => {
  const walletService = {
    ensureWallet: jest.fn(),
  };
  const tenantSettingsService = {
    getTenantSettings: jest.fn(),
  };

  let service: TenantWalletVirtualAccountService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme',
        createdBy: { email: 'owner@test.com' },
      }),
    };

    service = new TenantWalletVirtualAccountService(
      {} as never,
      walletService as never,
      tenantSettingsService as never,
      {} as never,
      {} as never,
      tenantRepository as never,
    );
    tenantSettingsService.getTenantSettings.mockResolvedValue({
      settings: { billing: { contactEmail: 'ops@test.com' } },
    });
  });

  it('flags provider mismatch when stored VA provider differs from active env', async () => {
    const wallet = {
      currencyCode: 'NGN',
      virtualAccountProvider: PaymentProvider.NOMBA,
      virtualAccountNumber: '1234567890',
      virtualAccountBank: 'Test Bank',
      virtualAccountReference: 'ref-old',
    } as TenantWallet;

    const details = await service.describeVirtualAccount('tenant-1', wallet);

    expect(details.providerMismatch).toBe(true);
    expect(details.ready).toBe(false);
    expect(details.status).toBe('update_required');
    expect(details.accountNumber).toBeNull();
    expect(details.error).toMatch(/Create a new bank account/i);
  });
});
