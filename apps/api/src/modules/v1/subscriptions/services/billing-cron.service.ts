import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

    this.logger.log('Running subscription renewal billing job');
    const result = await this.billingService.processDueRenewals();
    this.logger.log(
      `Renewal job finished: ${result.charged} charged, ${result.failed} failed, ${result.skipped} skipped, ${result.suspended} suspended`,
    );
  }
}
