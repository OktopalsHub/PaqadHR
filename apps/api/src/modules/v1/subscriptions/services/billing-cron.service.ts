import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { SubscriptionBillingService } from './subscription-billing.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(private readonly billingService: SubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async processSubscriptionRenewals(): Promise<void> {
    if (!isBillingGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'subscription-renewals', async () => {
      const result = await this.billingService.processDueRenewals();
      return {
        charged: result.charged,
        failed: result.failed,
        skipped: result.skipped,
        suspended: result.suspended,
      };
    });
  }
}
