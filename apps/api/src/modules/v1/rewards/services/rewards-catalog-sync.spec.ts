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
        tremendousProducts?: unknown[];
      };
    };
  };
  let settingsRepo: { findOne: jest.Mock; save: jest.Mock };
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
    listTremendousProducts = jest.fn().mockResolvedValue([]);

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
      {} as any, // walletService
      {} as any, // walletTopupService
      { list: jest.fn().mockResolvedValue([]) } as any, // customRewardsService
      {} as any, // _tenantConfigService
      { convert: jest.fn() } as any, // fiatExchange
      {} as any, // nombaBillApi
      {} as any, // monnifyBillApi
      {} as any, // _nombaTransferApi
      {} as any, // subscriptionsService
      {} as any, // activitiesService
      tremendousApi as any, // tremendousApi
      {} as any, // emailTemplateService
      {} as any, // emailService
      {} as any, // notificationHelper
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

  it('syncs Tremendous products for allowlisted countries', async () => {
    listTremendousProducts.mockResolvedValue([
      {
        id: 'AMAZON_NG',
        name: 'Amazon NG',
        category: 'merchant_cards',
        subcategory: 'retail',
        currency_codes: ['NGN'],
        countries: [{ abbr: 'NG' }],
        skus: [{ min: 1000, max: 1000 }],
        images: [{ src: 'https://example.com/amazon.png', type: 'card' }],
      },
    ]);

    const products = await service.syncTremendousProducts('tenant-1');
    expect(listTremendousProducts).toHaveBeenCalledWith(['NG']);
    expect(products).toHaveLength(1);
    expect(products[0].productId).toBe('AMAZON_NG');
    expect(settingsRow.settings.rewards.tremendousProducts).toHaveLength(1);
  });

  it('expands multi-country Tremendous products across the allowlist', async () => {
    settingsRow.settings.rewards.catalogCountries = ['NG', 'GB'];
    listTremendousProducts.mockResolvedValue([
      {
        id: 'MULTI',
        name: 'Global Card',
        category: 'merchant_cards',
        subcategory: 'retail',
        currency_codes: ['USD'],
        countries: [{ abbr: 'NG' }, { abbr: 'GB' }, { abbr: 'US' }],
        skus: [{ min: 10, max: 10 }],
        images: [{ src: 'https://testflight.tremendous.com/card.png', type: 'card' }],
      },
    ]);

    const products = await service.syncTremendousProducts('tenant-1');
    expect(listTremendousProducts).toHaveBeenCalledWith(['NG', 'GB']);
    expect(products).toHaveLength(2);
    expect(products.map((p) => p.countryCode).sort()).toEqual(['GB', 'NG']);
    expect(products[0].countries).toEqual(['NG', 'GB', 'US']);
    expect(products[0].imageUrl).toContain('tremendous.com');
  });

  it('uses the environment provider only', async () => {
    tenantCountryCode = 'US';
    settingsRow.settings.rewards.rewardsCurrency = 'USD';
    settingsRow.settings.rewards.catalogCountries = ['US'];
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

    const catalog = await service.getCatalog('tenant-1');
    expect(catalog.find((item) => item.type === 'TREMENDOUS')?.id).toBe('tremendous_US_AMAZONUS');
  });

  it('rejects catalog countries outside the tenant allowlist', async () => {
    await expect(service.getCatalog('tenant-1', { countryCode: 'GB' })).rejects.toThrow(
      'Catalog country is not enabled',
    );
  });

  it('defaults catalog countries to the tenant country', async () => {
    settingsRow.settings.rewards.catalogCountries = [];
    const settings = await (service as any).getRewardsSettings('tenant-1');
    expect(settings.catalogCountries).toEqual(['NG']);

    tenantCountryCode = 'GB';
    settingsRow.settings.rewards.catalogCountries = [];
    const otherSettings = await (service as any).getRewardsSettings('tenant-1');
    expect(otherSettings.catalogCountries).toEqual(['GB']);
  });
});
