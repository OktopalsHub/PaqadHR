import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingProductSyncService } from './billing-product-sync.service';
import { SubscriptionBillingService } from './subscription-billing.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly billingService: SubscriptionBillingService,
    private readonly productSync: BillingProductSyncService,
  ) {}

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

  /**
   * Managed (Bachs/Polar) and checkout-only (Monnify) renewals are not cron-charged.
   * If nextBillingDate drifts past a 3-day grace window, mark PAST_DUE so the gate kicks in.
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async lapseStaleSubscriptions(): Promise<void> {
    if (!isBillingGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'subscription-grace-lapse', async () => {
      return this.billingService.lapseStaleSubscriptions();
    });
  }

  /** @deprecated Prefer lapseStaleSubscriptions. */
  async lapseStaleBachsSubscriptions(): Promise<void> {
    return this.lapseStaleSubscriptions();
  }

  /** Create provider products for any plan_prices still missing IDs. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async healMissingBillingProducts(): Promise<void> {
    if (!isBillingGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'billing-product-heal', async () => {
      return this.productSync.healMissingProductIds();
    });
  }
}
