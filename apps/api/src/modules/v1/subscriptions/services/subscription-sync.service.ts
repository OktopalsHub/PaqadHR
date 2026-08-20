import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { In, LessThan, Not, IsNull, Repository } from 'typeorm';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { BillingProviderFactoryService } from './billing-provider-factory.service';

/**
 * Handles external subscription synchronization.
 */
@Injectable()
export class SubscriptionSyncService {
  private readonly logger = new Logger(SubscriptionSyncService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepository: Repository<BillingEvent>,
  ) {}

  async reconcileStaleManagedSubscriptions(): Promise<{ synced: number; failed: number }> {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 24);

    const stale = await this.subscriptionRepository.find({
      where: {
        billingProvider: In([BillingProvider.POLAR, BillingProvider.BACHS]),
        externalSubscriptionId: Not(IsNull()),
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.PAST_DUE,
        ]),
        updatedAt: LessThan(staleDate),
      },
    });

    let synced = 0;
    let failed = 0;

    for (const subscription of stale) {
      try {
        await this.syncExternalSubscription(subscription);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to sync ${subscription.billingProvider} subscription ${subscription.id}: ${message}`,
        );
      }
    }

    return { synced, failed };
  }

  async syncExternalSubscription(subscription: TenantSubscription): Promise<TenantSubscription> {
    if (
      !isManagedSubscriptionProvider(subscription.billingProvider) ||
      !subscription.externalSubscriptionId
    ) {
      return subscription;
    }

    const provider = this.billingProviderFactory.getProviderByEnum(subscription.billingProvider);
    const remote = (await provider.getSubscription(subscription.externalSubscriptionId)) as Record<
      string,
      unknown
    >;

    const remoteStatus = String(remote.status ?? '').toLowerCase();
    
    if (remoteStatus === 'trialing' || remoteStatus === 'trial') {
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        subscription.status = SubscriptionStatus.TRIAL;
      }
    } else if (remoteStatus) {
      subscription.status = provider.mapStatus(remoteStatus);
    }

    const cancelAtPeriodEnd = remote.cancel_at_period_end;
    if (typeof cancelAtPeriodEnd === 'boolean') {
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    const periodEnd = this.parseRemoteDate(
      remote.current_period_end ?? remote.currentPeriodEnd ?? remote.ends_at,
    );
    if (periodEnd) {
      subscription.currentPeriodEnd = periodEnd;
    }

    const nextBilling = this.parseRemoteDate(
      remote.next_billed_at ?? remote.nextBillingDate ?? remote.current_period_end,
    );
    if (nextBilling) {
      subscription.nextBillingDate = nextBilling;
    }

    if (remoteStatus === 'canceled' || remoteStatus === 'cancelled' || remoteStatus === 'revoked') {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = subscription.cancelledAt ?? new Date();
    }

    return this.subscriptionRepository.save(subscription);
  }

  private parseRemoteDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
