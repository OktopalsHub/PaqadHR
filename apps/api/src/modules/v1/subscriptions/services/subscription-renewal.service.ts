import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Brackets, DataSource, In, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { RENEWAL_GRACE_PERIOD_DAYS } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { computeDunningNextRetryAt, maxDunningAttempts } from '../utils/dunning.util';
import { getBillingFailureMessage, mapNombaBillingFailure } from '../utils/nomba-billing-failure.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { PlansService } from '../../plans/services/plans.service';
import { Optional } from '@nestjs/common';

export interface RenewalJobResult {
  charged: number;
  failed: number;
  skipped: number;
  suspended: number;
}

/**
 * Handles subscription renewal processing and dunning management.
 */
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly tenantSettingsService: TenantSettingsService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepository: Repository<BillingEvent>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional() private readonly notificationHelper?: NotificationHelperService,
  ) {}

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) {
      return result;
    }

    const now = new Date();
    result.suspended = await this.suspendPastGraceSubscriptions(now);
    await this.finalizeScheduledCancellations(now);

    const dueSubscriptions = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.planPrice', 'planPrice')
      .leftJoinAndSelect('sub.tenant', 'tenant')
      .leftJoinAndSelect('tenant.createdBy', 'createdBy')
      .where('sub.payment_method_id IS NOT NULL')
      .andWhere('sub.billing_provider = :nomba', { nomba: BillingProvider.NOMBA })
      .andWhere('sub.nomba_subscription_id IS NOT NULL')
      .andWhere('sub.status NOT IN (:...excluded)', {
        excluded: [SubscriptionStatus.CANCELLED, SubscriptionStatus.PAUSED],
      })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            new Brackets((inner) => {
              inner
                .where('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
                .andWhere('sub.next_billing_date <= :now', { now })
                .andWhere('sub.cancel_at_period_end = false');
            }),
          ).orWhere(
            new Brackets((inner) => {
              inner
                .where('sub.status = :pastDue', { pastDue: SubscriptionStatus.PAST_DUE })
                .andWhere('sub.dunning_next_retry_at <= :now', { now })
                .andWhere('sub.dunning_attempt_count < :maxAttempts', {
                  maxAttempts: maxDunningAttempts(),
                });
            }),
          );
        }),
      )
      .getMany();

    for (const subscription of dueSubscriptions) {
      // Renewal charging logic would be here
      // For now, just count as skipped if not implemented
      result.skipped += 1;
    }

    return result;
  }

  private async suspendPastGraceSubscriptions(now: Date): Promise<number> {
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - RENEWAL_GRACE_PERIOD_DAYS);

    const update = await this.subscriptionRepository
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.SUSPENDED })
      .where('status = :status', { status: SubscriptionStatus.PAST_DUE })
      .andWhere('next_billing_date < :graceCutoff', { graceCutoff })
      .execute();

    return update.affected ?? 0;
  }

  private async finalizeScheduledCancellations(now: Date): Promise<void> {
    await this.subscriptionRepository
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: now,
        cancelAtPeriodEnd: false,
      })
      .where('cancel_at_period_end = true')
      .andWhere('current_period_end <= :now', { now })
      .andWhere('status = :status', { status: SubscriptionStatus.ACTIVE })
      .execute();
  }

  private async notifyRenewalIssue(
    subscription: TenantSubscription,
    status: string,
    reason: string,
  ): Promise<void> {
    const ownerId = subscription.tenant?.createdBy?.id;
    if (!ownerId || !this.notificationHelper) {
      return;
    }

    const ownerMember = await this.tenantMemberRepository.findOne({
      where: { userId: ownerId, tenantId: subscription.tenantId },
      select: ['id'],
    });
    if (!ownerMember) {
      return;
    }

    await this.notificationHelper.sendBillingRenewalFailedNotification(
      ownerMember.id,
      subscription.tenantId,
      {
        tenantName: subscription.tenant?.name ?? 'your workspace',
        reason,
        status,
      },
    );
  }
}
