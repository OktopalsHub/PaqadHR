import { DataSource } from 'typeorm';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
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
        giftCardProvider?: 'reloadly' | 'tremendous';
        reloadlyProducts: unknown[];
        tremendousProducts?: unknown[];
      };
    };
  };
  let settingsRepo: { findOne: jest.Mock; save: jest.Mock };
  let listAccountProducts: jest.Mock;
  let listTremendousProducts: jest.Mock;
  let tenantCountryCode: string;

  beforeEach(() => {
    settingsRow = {
      tenantId: 'tenant-1',
      settings: {
        rewards: {
          enabled: true,
          pointsExchangeRate: 1,
          rewardsCurrency: 'NGN',
          catalogCountries: ['NG'],
          giftCardProvider: 'reloadly',
          reloadlyProducts: [],
          tremendousProducts: [],
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

    tenantCountryCode = 'NG';

    listAccountProducts = jest.fn().mockResolvedValue([
      {
        productId: 101,
        productName: 'Amazon NG',
        countryCode: 'NG',
        recipientCurrencyCode: 'NGN',
        senderCurrencyCode: 'NGN',
        fixedRecipientDenominations: [1000],
        fixedSenderDenominations: [980],
        minRecipientDenomination: 1000,
        maxRecipientDenomination: 50000,
        logoUrls: ['https://example.com/amazon.png'],
      },
    ]);

    listTremendousProducts = jest.fn().mockResolvedValue([]);

    const reloadlyApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      listAccountProducts,
    };
    const tremendousApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      listProducts: listTremendousProducts,
    };

    service = new RewardsService(
      {
        getRepository: jest.fn((entity) => {
          if (entity === TenantSettings) return settingsRepo;
          if (entity === Tenant) {
            return {
              findOne: jest.fn().mockImplementation(async () => ({
                id: 'tenant-1',
                countryCode: tenantCountryCode,
                preferredCurrency: tenantCountryCode === 'NG' ? 'NGN' : 'USD',
                createdBy: null,
              })),
            };
          }
          if (entity === TenantWallet) {
            return {
              findOne: jest.fn().mockResolvedValue({
                tenantId: 'tenant-1',
                currencyCode: tenantCountryCode === 'NG' ? 'NGN' : 'USD',
                balanceAmount: 0,
              }),
            };
          }
          return {};
        }),
      } as unknown as DataSource,
      {} as any,
      {} as any,
      { list: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      reloadlyApi as any,
      {} as any,
      { convert: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getRedemptionFees: jest.fn().mockResolvedValue({ feePercentage: 2, flatFee: 0 }),
      } as any,
      {} as any,
      tremendousApi as any,
    );

    jest.spyOn(service as any, 'getSubscriptionFees').mockResolvedValue({
      feePercentage: 2,
      flatFee: 0,
    });
    jest
      .spyOn(service as any, 'toWalletCurrency')
      .mockImplementation(async (amount: number, from?: string) =>
        from?.toUpperCase() === 'USD' ? amount * 1500 : amount,
      );
  });

  it('syncs Reloadly products when catalog is empty', async () => {
    const products = await service.syncReloadlyProducts('tenant-1');
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe(101);
    expect(products[0].listReloadlyCost).toBe(980);
    expect(products[0].listReloadlyCostCurrency).toBe('NGN');
    expect(products[0].wholesaleInRewardsCurrency).toBe(980);
    expect(products[0].pointsCost).toBe(1000);
    expect(settingsRow.settings.rewards.reloadlyProducts).toHaveLength(1);
  });

  it('prices USD sender cost with FX conversion', async () => {
    listAccountProducts.mockResolvedValue([
      {
        productId: 202,
        productName: 'Amazon US',
        countryCode: 'US',
        recipientCurrencyCode: 'USD',
        senderCurrencyCode: 'USD',
        fixedRecipientDenominations: [10],
        fixedSenderDenominations: [10],
        minRecipientDenomination: 10,
        maxRecipientDenomination: 100,
        logoUrls: ['https://example.com/amazon-us.png'],
      },
    ]);

    const products = await service.syncReloadlyProducts('tenant-1');
    expect(products[0].listReloadlyCost).toBe(10);
    expect(products[0].listReloadlyCostCurrency).toBe('USD');
    expect(products[0].wholesaleInRewardsCurrency).toBe(15000);
    expect(products[0].pointsCost).toBe(15300);
  });

  it('dedupes products with the same productId across countries', async () => {
    listAccountProducts.mockResolvedValue([
      {
        productId: 303,
        productName: 'Global Card',
        countryCode: 'NG',
        recipientCurrencyCode: 'NGN',
        senderCurrencyCode: 'NGN',
        fixedRecipientDenominations: [500],
        fixedSenderDenominations: [490],
        logoUrls: [],
      },
      {
        productId: 303,
        productName: 'Global Card',
        countryCode: 'US',
        recipientCurrencyCode: 'USD',
        senderCurrencyCode: 'USD',
        fixedRecipientDenominations: [5],
        fixedSenderDenominations: [5],
        logoUrls: [],
      },
    ]);

    const products = await service.syncReloadlyProducts('tenant-1');
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe(303);
    expect(products[0].countryCode).toBe('NG');
  });

  it('returns non-empty catalog after sync', async () => {
    const catalog = await service.getCatalog('tenant-1', { includeAdminPricing: true });
    const reloadlyItem = catalog.find((item) => item.type === 'RELOADLY');
    expect(reloadlyItem).toBeDefined();
    expect(reloadlyItem?.currencyValue).toBe(1000);
    expect(reloadlyItem?.adminPricing).toEqual({
      reloadlyCost: 980,
      reloadlyCostCurrency: 'NGN',
    });
  });

  it('validates reloadly gift card points against stored catalog cost', async () => {
    await service.syncReloadlyProducts('tenant-1');
    const catalog = await service.getCatalog('tenant-1');
    const item = catalog.find((i) => i.id === 'reloadly_101');
    expect(item).toBeDefined();

    await expect(
      service.claim('tenant-1', 'member-1', {
        rewardType: 'RELOADLY',
        rewardId: item!.id,
        pointsCost: item!.pointsCost - 1,
        currencyValue: item!.currencyValue,
        currencyCode: item!.currencyCode,
      }),
    ).rejects.toThrow('Invalid points cost');
  });

  it('omits admin pricing for members', async () => {
    const catalog = await service.getCatalog('tenant-1');
    const reloadlyItem = catalog.find((item) => item.type === 'RELOADLY');
    expect(reloadlyItem?.adminPricing).toBeUndefined();
  });

  it('includes admin pricing for non-rewards currency costs', async () => {
    settingsRow.settings.rewards.reloadlyProducts = [
      {
        productId: 999,
        name: 'USD cost card',
        countryCode: 'US',
        currencyCode: 'USD',
        imageUrl: null,
        pointsCost: 100,
        listReloadlyCost: 10,
        listReloadlyCostCurrency: 'USD',
      },
    ];

    const catalog = await service.getCatalog('tenant-1', { includeAdminPricing: true });
    const reloadlyItem = catalog.find((item) => item.id === 'reloadly_999');
    expect(reloadlyItem?.adminPricing).toEqual({
      reloadlyCost: 10,
      reloadlyCostCurrency: 'USD',
    });
  });

  it('syncs Tremendous products and returns only TREMENDOUS catalog items for non-NG', async () => {
    tenantCountryCode = 'US';
    settingsRow.settings.rewards.rewardsCurrency = 'USD';
    settingsRow.settings.rewards.giftCardProvider = 'tremendous';
    listTremendousProducts.mockResolvedValue([
      {
        id: 'AMAZONUS',
        name: 'Amazon.com Gift Card',
        category: 'merchant_cards',
        subcategory: 'retail',
        currency_codes: ['USD'],
        countries: [{ abbr: 'US' }],
        skus: [
          { min: 10, max: 10 },
          { min: 25, max: 25 },
        ],
        images: [{ src: 'https://example.com/amazon.png', type: 'card' }],
      },
    ]);

    const products = await service.syncTremendousProducts('tenant-1');
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe('AMAZONUS');
    expect(products[0].fixedDenominations).toEqual([10, 25]);
    expect(products[0].listTremendousCost).toBe(10);

    const catalog = await service.getCatalog('tenant-1');
    expect(catalog.some((item) => item.type === 'RELOADLY')).toBe(false);
    const tremendousItem = catalog.find((item) => item.type === 'TREMENDOUS');
    expect(tremendousItem?.id).toBe('tremendous_AMAZONUS');
    expect(tremendousItem?.currencyValue).toBe(10);
  });

  it('unions Tremendous and Reloadly catalogs for Nigeria workspaces', async () => {
    settingsRow.settings.rewards.giftCardProvider = 'tremendous';
    listTremendousProducts.mockResolvedValue([
      {
        id: 'AMAZONUS',
        name: 'Amazon.com Gift Card',
        currency_codes: ['USD'],
        countries: [{ abbr: 'US' }],
        skus: [{ min: 10, max: 10 }],
        images: [],
      },
    ]);

    const catalog = await service.getCatalog('tenant-1');
    expect(catalog.some((item) => item.type === 'RELOADLY')).toBe(true);
    expect(catalog.some((item) => item.type === 'TREMENDOUS')).toBe(true);
  });

  it('does not infer catalog countries from the workspace', async () => {
    const settings = await (service as any).getRewardsSettings('tenant-1');
    expect(settings.catalogCountries).toEqual(['NG']);

    tenantCountryCode = 'GB';
    const otherSettings = await (service as any).getRewardsSettings('tenant-1');
    expect(otherSettings.catalogCountries).toEqual(['NG']);
  });
});
