import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { isTremendousConfigured } from 'src/common/config/tremendous.config';
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

  @Cron('0 */4 * * *')
  async syncAllTenantCatalogs(): Promise<void> {
    if (!isTremendousConfigured()) {
      return;
    }

    await runCronJob(this.logger, 'rewards-catalog-sync', async () => {
      const rows = await this.tenantSettingsRepository.find();
      const eligible = rows.filter((row) => {
        const rewards = row.settings?.rewards;
        return rewards?.enabled !== false;
      });

      let synced = 0;
      let failed = 0;

      for (const row of eligible) {
        try {
          await this.rewardsService.syncCatalog(row.tenantId, {
            force: true,
          });
          synced += 1;
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
