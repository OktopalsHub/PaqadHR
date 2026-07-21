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

  /** Pull Polar/Bachs remote state for subscriptions not touched in 24h. */
  @Cron(CronExpression.EVERY_12_HOURS)
  async syncManagedSubscriptions(): Promise<void> {
    if (!isBillingGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'managed-subscription-sync', async () => {
      return this.billingService.reconcileStaleManagedSubscriptions();
    });
  }

  /**
   * Bachs renewals are webhook-driven. If a renewal webhook is lost and the
   * period end drifts past a 3-day grace window, mark PAST_DUE so the gate kicks in.
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async lapseStaleBachsSubscriptions(): Promise<void> {
    if (!isBillingGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'bachs-grace-lapse', async () => {
      return this.billingService.lapseStaleBachsSubscriptions();
    });
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
