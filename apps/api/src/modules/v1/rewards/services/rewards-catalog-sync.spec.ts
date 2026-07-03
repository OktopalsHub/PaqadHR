import { DataSource } from 'typeorm';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { RewardsService } from './rewards.service';

describe('RewardsService catalog sync', () => {
  let service: RewardsService;
  let settingsRow: {
    tenantId: string;
    settings: {
      rewards: {
        enabled: boolean;
        pointsExchangeRate: number;
        rewardsCurrency: string;
        catalogCountries: string[];
        reloadlyProducts: unknown[];
      };
    };
  };
  let settingsRepo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    settingsRow = {
      tenantId: 'tenant-1',
      settings: {
        rewards: {
          enabled: true,
          pointsExchangeRate: 1,
          rewardsCurrency: 'NGN',
          catalogCountries: ['NG'],
          reloadlyProducts: [],
        },
      },
    };

    settingsRepo = {
      findOne: jest.fn().mockImplementation(async () => settingsRow),
      save: jest.fn().mockImplementation(async (row) => {
        settingsRow = row;
        return row;
      }),
    };

    const reloadlyApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      listProductsByCountries: jest.fn().mockResolvedValue([
        {
          productId: 101,
          productName: 'Amazon NG',
          countryCode: 'NG',
          recipientCurrencyCode: 'NGN',
          fixedRecipientDenominations: [1000],
          minRecipientDenomination: 1000,
          maxRecipientDenomination: 50000,
          logoUrls: ['https://example.com/amazon.png'],
        },
      ]),
    };

    service = new RewardsService(
      {
        getRepository: jest.fn((entity) => {
          if (entity === TenantSettings) return settingsRepo;
          return {};
        }),
      } as unknown as DataSource,
      {} as any,
      { list: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      reloadlyApi as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getRedemptionFees: jest.fn().mockResolvedValue({ feePercentage: 2, flatFee: 50 }),
      } as any,
    );

    jest.spyOn(service as any, 'getSubscriptionFees').mockResolvedValue({
      feePercentage: 2,
      flatFee: 50,
    });
    jest
      .spyOn(service as any, 'toWalletCurrency')
      .mockImplementation(async (amount: number) => amount);
  });

  it('syncs Reloadly products when catalog is empty', async () => {
    const products = await service.syncReloadlyProducts('tenant-1');
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe(101);
    expect(settingsRow.settings.rewards.reloadlyProducts).toHaveLength(1);
  });

  it('returns non-empty catalog after sync', async () => {
    const catalog = await service.getCatalog('tenant-1');
    expect(catalog.some((item) => item.type === 'RELOADLY')).toBe(true);
  });
});
