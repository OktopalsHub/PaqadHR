import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';

/**
 * Handles subscription reconciliation and lapse management.
 */
@Injectable()
export class SubscriptionReconciliationService {
  private readonly logger = new Logger(SubscriptionReconciliationService.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
  ) {}

  /**
   * Bachs/Polar renewals are webhook-only; Monnify requires manual checkout.
   * After a 3-day grace past nextBillingDate with no renewal, mark PAST_DUE
   * so entitlements stop instead of staying ACTIVE forever.
   */
  async lapseStaleSubscriptions(): Promise<{ lapsed: number }> {
    const graceMs = 3 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - graceMs);

    const stale = await this.subscriptionRepository.find({
      where: {
        billingProvider: In([
          BillingProvider.BACHS,
          BillingProvider.POLAR,
          BillingProvider.MONNIFY,
        ]),
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: LessThanOrEqual(cutoff),
      },
    });

    let lapsed = 0;
    for (const subscription of stale) {
      // Managed providers must have an external id; Monnify is checkout-only.
      if (
        isManagedSubscriptionProvider(subscription.billingProvider) &&
        !subscription.externalSubscriptionId
      ) {
        continue;
      }
      subscription.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepository.save(subscription);
      lapsed += 1;
      this.logger.warn(
        `Lapsed stale ${subscription.billingProvider} subscription ${subscription.id} for tenant ${subscription.tenantId}`,
      );
    }

    return { lapsed };
  }

  /** @deprecated Prefer lapseStaleSubscriptions — kept for callers/tests. */
  async lapseStaleBachsSubscriptions(): Promise<{ lapsed: number }> {
    return this.lapseStaleSubscriptions();
  }
}
