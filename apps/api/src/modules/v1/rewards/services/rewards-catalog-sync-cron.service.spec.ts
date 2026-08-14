import { RewardsService } from './rewards.service';
import { RewardsCatalogSyncCronService } from './rewards-catalog-sync-cron.service';

jest.mock('src/common/config/reloadly.config', () => ({
  isReloadlyConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('src/common/config/tremendous.config', () => ({
  isTremendousConfigured: jest.fn().mockReturnValue(true),
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
      syncCatalog: jest.fn().mockResolvedValue({ provider: 'tremendous', count: 1 }),
    };

    const cron = new RewardsCatalogSyncCronService(
      tenantSettingsRepository as any,
      rewardsService as unknown as RewardsService,
    );

    await cron.syncAllTenantCatalogs();

    expect(rewardsService.syncCatalog).toHaveBeenCalledTimes(1);
    expect(rewardsService.syncCatalog).toHaveBeenCalledWith('tenant-1', { force: true });
  });
});
