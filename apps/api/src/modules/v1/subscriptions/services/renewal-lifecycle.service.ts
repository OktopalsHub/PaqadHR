import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { RENEWAL_GRACE_PERIOD_DAYS } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { computeDunningNextRetryAt } from '../utils/dunning.util';
import { mapNombaBillingFailure } from '../utils/nomba-billing-failure.util';
import { BillingEventStore } from './billing-event-store';

@Injectable()
export class RenewalLifecycleService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantMember) private readonly tenantMemberRepo: Repository<TenantMember>,
    private readonly billingEventStore: BillingEventStore,
    private readonly notificationHelper?: NotificationHelperService,
  ) {}

  async suspendPastGraceSubscriptions(now: Date): Promise<number> {
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - RENEWAL_GRACE_PERIOD_DAYS);
    const toSuspend = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        nextBillingDate: LessThanOrEqual(graceCutoff),
      },
      relations: ['tenant', 'tenant.createdBy'],
    });
    const update = await this.subscriptionRepo
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.SUSPENDED })
      .where('status = :status', { status: SubscriptionStatus.PAST_DUE })
      .andWhere('next_billing_date < :graceCutoff', { graceCutoff })
      .execute();
    for (const sub of toSuspend)
      await this.notifyRenewalIssue(sub, 'SUSPENDED', 'Grace period expired.');
    return update.affected ?? 0;
  }

  async finalizeScheduledCancellations(now: Date): Promise<void> {
    await this.subscriptionRepo
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.CANCELLED, cancelledAt: now, cancelAtPeriodEnd: false })
      .where('cancel_at_period_end = true')
      .andWhere('current_period_end <= :now', { now })
      .andWhere('status = :status', { status: SubscriptionStatus.ACTIVE })
      .execute();
  }

  resetDunningFields(subscription: TenantSubscription): void {
    subscription.dunningAttemptCount = 0;
    subscription.dunningNextRetryAt = null;
    subscription.lastPaymentFailureReason = null;
    subscription.lastPaymentFailureDetail = null;
  }

  async markRenewalFailed(
    subscription: TenantSubscription,
    reference: string,
    reason: string,
  ): Promise<void> {
    const mapped = mapNombaBillingFailure(reason);
    const nextCount = (subscription.dunningAttemptCount ?? 0) + 1;
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.dunningAttemptCount = nextCount;
    subscription.dunningNextRetryAt = computeDunningNextRetryAt(
      subscription.nextBillingDate,
      nextCount,
    );
    subscription.lastPaymentFailureReason = mapped.code;
    subscription.lastPaymentFailureDetail = reason;
    subscription.billingHistory = [
      ...(subscription.billingHistory ?? []),
      {
        date: new Date(),
        amount: 0,
        currency: subscription.planPrice?.currency ?? 'USD',
        status: 'failed' as const,
        invoiceId: reference,
        failureReason: mapped.code,
      },
    ];
    await this.subscriptionRepo.save(subscription);
    await this.billingEventStore.recordBillingEvent(
      `renewal_failed_${reference}`,
      'renewal_failed',
      {
        tenantId: subscription.tenantId,
        reason: mapped.code,
      },
    );
    const tenant = await this.tenantRepo.findOne({
      where: { id: subscription.tenantId },
      relations: ['createdBy'],
    });
    if (tenant) subscription.tenant = tenant;
    await this.notifyRenewalIssue(subscription, 'PAST_DUE', mapped.message);
  }

  async notifyRenewalIssue(
    subscription: TenantSubscription,
    status: string,
    reason: string,
  ): Promise<void> {
    const ownerId = subscription.tenant?.createdBy?.id;
    if (!ownerId || !this.notificationHelper) return;
    const member = await this.tenantMemberRepo.findOne({
      where: { userId: ownerId, tenantId: subscription.tenantId },
      select: ['id'],
    });
    if (!member) return;
    await this.notificationHelper.sendBillingRenewalFailedNotification(
      member.id,
      subscription.tenantId,
      { tenantName: subscription.tenant?.name ?? 'your workspace', reason, status },
    );
  }

  async lapseStaleSubscriptions(): Promise<{ lapsed: number }> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const stale = await this.subscriptionRepo.find({
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
    for (const sub of stale) {
      if (isManagedSubscriptionProvider(sub.billingProvider) && !sub.externalSubscriptionId)
        continue;
      sub.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepo.save(sub);
      lapsed += 1;
    }
    return { lapsed };
  }

  async lapseStaleBachsSubscriptions() {
    return this.lapseStaleSubscriptions();
  }
}
