import { RewardsCatalogSyncCronService } from './rewards-catalog-sync-cron.service';
import { RewardsService } from './rewards.service';

jest.mock('src/common/config/reloadly.config', () => ({
  isReloadlyConfigured: jest.fn().mockReturnValue(true),
}));

describe('RewardsCatalogSyncCronService', () => {
  it('syncs eligible tenant catalogs', async () => {
    const tenantSettingsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          tenantId: 'tenant-1',
          settings: { rewards: { enabled: true, catalogCountries: ['NG'] } },
        },
        {
          tenantId: 'tenant-2',
          settings: { rewards: { enabled: false, catalogCountries: ['NG'] } },
        },
      ]),
    };
    const rewardsService = {
      syncReloadlyProducts: jest.fn().mockResolvedValue([{ productId: 1 }]),
    };

    const cron = new RewardsCatalogSyncCronService(
      tenantSettingsRepository as any,
      rewardsService as unknown as RewardsService,
    );

    await cron.syncAllTenantCatalogs();

    expect(rewardsService.syncReloadlyProducts).toHaveBeenCalledTimes(1);
    expect(rewardsService.syncReloadlyProducts).toHaveBeenCalledWith('tenant-1', { force: true });
  });
});
