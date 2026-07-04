import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { isReloadlyConfigured } from 'src/common/config/reloadly.config';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { Repository } from 'typeorm';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { RewardsService } from './rewards.service';

@Injectable()
export class RewardsCatalogSyncCronService {
  private readonly logger = new Logger(RewardsCatalogSyncCronService.name);

  constructor(
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    private readonly rewardsService: RewardsService,
  ) {}

  @Cron('0 0,12 * * *')
  async syncAllTenantCatalogs(): Promise<void> {
    if (!isReloadlyConfigured()) {
      return;
    }

    await runCronJob(this.logger, 'rewards-catalog-sync', async () => {
      const rows = await this.tenantSettingsRepository.find();
      const eligible = rows.filter((row) => {
        const rewards = row.settings?.rewards;
        return (
          rewards?.enabled !== false &&
          Array.isArray(rewards?.catalogCountries) &&
          rewards.catalogCountries.length > 0
        );
      });

      let synced = 0;
      let failed = 0;

      for (const row of eligible) {
        try {
          const products = await this.rewardsService.syncReloadlyProducts(row.tenantId, {
            force: true,
          });
          synced += 1;
          this.logger.log(`Synced ${products.length} Reloadly products for tenant ${row.tenantId}`);
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `Catalog sync failed for tenant ${row.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return { synced, failed, total: eligible.length };
    });
  }
}
