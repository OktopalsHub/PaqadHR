import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { TenantWalletService } from './tenant-wallet.service';

@Injectable()
export class RewardsWalletVaCronService {
  private readonly logger = new Logger(RewardsWalletVaCronService.name);

  constructor(private readonly walletService: TenantWalletService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async provisionMissingVirtualAccounts(): Promise<void> {
    if (!isNombaConfigured()) {
      return;
    }

    if (!(await this.walletService.hasWalletsNeedingVirtualAccountProvision())) {
      return;
    }

    await runCronJob(this.logger, 'rewards-wallet-va-provision', async () => {
      return this.walletService.provisionMissingVirtualAccounts();
    });
  }
}
