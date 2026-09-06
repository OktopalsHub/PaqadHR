import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Brackets, DataSource, In, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { MonnifyApiService } from '../../../../common/services/monnify-api.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingChargeType, RENEWAL_GRACE_PERIOD_DAYS } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookPayment } from '../interfaces/subscription-billing.interface';
import { computeDunningNextRetryAt, maxDunningAttempts } from '../utils/dunning.util';
import { mapNombaBillingFailure } from '../utils/nomba-billing-failure.util';
import { calculatePerSeatTotal, normalizeWebhookAmount } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { NombaApiService } from './nomba-api.service';
import { SeatPricingCalculator } from './seat-pricing-calculator';

export interface RenewalJobResult {
  charged: number;
  failed: number;
  skipped: number;
  suspended: number;
}

@Injectable()
export class RenewalProcessor {
  private readonly logger = new Logger(RenewalProcessor.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    @InjectRepository(BillingEvent) private readonly billingEventRepo: Repository<BillingEvent>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantMember) private readonly tenantMemberRepo: Repository<TenantMember>,
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly seatPricing: SeatPricingCalculator,
    private readonly monnifyApi: MonnifyApiService,
    private readonly nombaApi: NombaApiService,
    private readonly tenantSettingsService: TenantSettingsService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationHelper?: NotificationHelperService,
  ) {}

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) return result;
    const now = new Date();
    await this.seatPricing.reclaimStuckPendingSeatCharges();
    result.suspended = await this.suspendPastGraceSubscriptions(now);
    await this.finalizeScheduledCancellations(now);

    const dueSubscriptions = await this.subscriptionRepo
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
      const outcome = await this.chargeSubscriptionRenewal(subscription);
      if (outcome === 'charged') result.charged += 1;
      else if (outcome === 'failed') result.failed += 1;
      else result.skipped += 1;
    }
    return result;
  }

  private async chargeSubscriptionRenewal(
    subscription: TenantSubscription,
  ): Promise<'charged' | 'failed' | 'skipped'> {
    const attemptCount = subscription.dunningAttemptCount ?? 0;
    const billingProviderEnum =
      subscription.billingProvider ??
      this.billingProviderFactory.resolveBillingProvider(subscription.tenant?.countryCode);
    const periodEventId = this.renewalPeriodEventId(subscription.id, subscription.nextBillingDate);
    if (
      isManagedSubscriptionProvider(billingProviderEnum) ||
      subscription.nextBillingDate > new Date()
    )
      return 'skipped';

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice?.isActive) return 'skipped';
    const billingEmail = await this.resolveBillingEmail(
      subscription.tenantId,
      subscription.tenant?.createdBy?.email,
    );
    if (!billingEmail || !subscription.paymentMethodId || !subscription.nombaSubscriptionId)
      return 'skipped';

    const seatCount = await this.seatPricing.getTenantSeatCount(subscription.tenantId);
    const orderReference = this.buildNombaRenewalOrderReference(
      subscription.id,
      subscription.nextBillingDate,
    );
    const metadata = {
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      planPriceId: subscription.planPriceId,
      quantity: seatCount,
      orderReference,
    };

    await this.updateRenewalPeriodClaim(
      periodEventId,
      { status: 'pending', orderReference, claimedAt: new Date().toISOString() },
      billingProviderEnum,
    );

    try {
      const provider = this.billingProviderFactory.getProviderByEnum(billingProviderEnum);
      const charge = await provider.chargeRenewal(
        subscription.nombaSubscriptionId,
        planPrice,
        seatCount,
        subscription.paymentMethodId,
        billingEmail,
        metadata,
      );
      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'charged', orderReference: charge.orderReference || orderReference },
        billingProviderEnum,
      );

      const verified = await this.verifyPaymentReference(
        charge.orderReference,
        billingProviderEnum,
      );
      if (
        !verified ||
        (this.requiresProviderVerification(billingProviderEnum) &&
          !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
      ) {
        await this.updateRenewalPeriodClaim(
          periodEventId,
          { status: 'failed', orderReference: charge.orderReference, failed: true, attemptCount },
          billingProviderEnum,
        );
        await this.markRenewalFailed(subscription, charge.orderReference, 'verification_failed');
        return 'failed';
      }

      const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
      const normalizedPaid = normalizeWebhookAmount(
        Number(verified.amount ?? 0),
        expectedAmount,
        planPrice.currency,
      );
      await this.applyRenewalSuccess(
        subscription.tenantId,
        {
          eventId: charge.orderReference,
          reference: charge.orderReference,
          tenantId: subscription.tenantId,
          planId: subscription.planId,
          planPriceId: subscription.planPriceId,
          quantity: seatCount,
          amount: normalizedPaid,
          currency: planPrice.currency.toUpperCase(),
          tokenKey: subscription.paymentMethodId,
          status: 'success',
          billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
        },
        billingProviderEnum,
        subscription.nextBillingDate,
        attemptCount,
      );
      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'success', orderReference: charge.orderReference },
        billingProviderEnum,
      );
      return 'charged';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Renewal charge failed for ${subscription.tenantId}: ${message}`);
      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'failed', failed: true, attemptCount, detail: message },
        billingProviderEnum,
      );
      await this.markRenewalFailed(subscription, periodEventId, message);
      return 'failed';
    }
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

  resetDunningFields(subscription: TenantSubscription): void {
    subscription.dunningAttemptCount = 0;
    subscription.dunningNextRetryAt = null;
    subscription.lastPaymentFailureReason = null;
    subscription.lastPaymentFailureDetail = null;
  }

  renewalPeriodEventId(subscriptionId: string, billingDate: Date): string {
    return `renewal_period_${subscriptionId}_${billingDate.toISOString()}`;
  }

  buildNombaRenewalOrderReference(subscriptionId: string, billingDate: Date): string {
    return `sub_ren_${subscriptionId.replace(/-/g, '').slice(0, 24)}_${billingDate.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }

  advanceBillingPeriod(anchor: Date) {
    const s = new Date(anchor);
    const e = new Date(s);
    e.setMonth(e.getMonth() + 1);
    return { periodStart: s, periodEnd: e };
  }

  resolveBillingPeriod(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
    billingPeriodAnchor?: Date,
  ) {
    const next = payment.nextBillingDate ? new Date(payment.nextBillingDate) : null;
    const end = payment.currentPeriodEnd ? new Date(payment.currentPeriodEnd) : null;
    const start = payment.currentPeriodStart ? new Date(payment.currentPeriodStart) : null;
    if (next && !Number.isNaN(next.getTime())) {
      return {
        periodStart:
          start && !Number.isNaN(start.getTime())
            ? start
            : new Date(billingPeriodAnchor ?? subscription.nextBillingDate),
        periodEnd: end && !Number.isNaN(end.getTime()) ? end : next,
        nextBillingDate: next,
      };
    }
    const ps = new Date(billingPeriodAnchor ?? subscription.nextBillingDate);
    const pe = this.advanceBillingPeriod(ps).periodEnd;
    return { periodStart: ps, periodEnd: pe, nextBillingDate: pe };
  }

  async applyRenewalSuccess(
    tenantId: string,
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
    billingPeriodAnchor?: Date,
    attemptCount = 0,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({ where: { tenantId } });
    if (
      !subscription ||
      ![SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(subscription.status)
    )
      return;
    if (subscription.billingProvider !== provider) return;
    const planPrice = await this.plansService.getPlanPriceById(
      payment.planPriceId ?? subscription.planPriceId,
    );
    if (!planPrice?.isActive) return;
    const liveSeatCount = await this.seatPricing.getTenantSeatCount(tenantId);
    const chargedSeatCount =
      payment.quantity != null ? payment.quantity : (subscription.currentUsers ?? 1);
    const expectedAmount = calculatePerSeatTotal(planPrice, chargedSeatCount);
    const normalizedPaid = normalizeWebhookAmount(
      payment.amount ?? 0,
      expectedAmount,
      payment.currency ?? planPrice.currency,
    );
    const paidAmount = Number.isFinite(normalizedPaid)
      ? normalizedPaid
      : Number(payment.amount ?? 0);

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      if (await billingEventRepo.findOne({ where: { eventId: payment.eventId, provider } })) return;
      const subscriptionRepo = manager.getRepository(TenantSubscription);
      const locked = await subscriptionRepo.findOne({
        where: { tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.cancelAtPeriodEnd || locked.nextBillingDate > new Date()) return;

      const billingPeriod = isManagedSubscriptionProvider(provider)
        ? this.resolveBillingPeriod(payment, locked, billingPeriodAnchor)
        : {
            ...this.advanceBillingPeriod(billingPeriodAnchor ?? locked.nextBillingDate),
            nextBillingDate: this.advanceBillingPeriod(
              billingPeriodAnchor ?? locked.nextBillingDate,
            ).periodEnd,
          };

      locked.status = SubscriptionStatus.ACTIVE;
      locked.currentUsers = liveSeatCount;
      locked.currentPeriodStart = billingPeriod.periodStart;
      locked.currentPeriodEnd = billingPeriod.periodEnd;
      locked.nextBillingDate = billingPeriod.nextBillingDate;
      locked.billingProvider = provider;
      if (payment.tokenKey?.trim()) locked.paymentMethodId = payment.tokenKey;
      if (payment.cardBrand) locked.paymentMethodBrand = payment.cardBrand;
      if (payment.cardLastFour) locked.paymentMethodLastFour = payment.cardLastFour;
      this.resetDunningFields(locked);
      locked.billingHistory = [
        ...(locked.billingHistory ?? []),
        {
          date: new Date(),
          amount: paidAmount,
          currency: payment.currency ?? 'USD',
          status: 'paid' as const,
          invoiceId: payment.reference,
        },
      ];
      await subscriptionRepo.save(locked);
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: payment.eventId,
          provider,
          eventType: 'subscription_renewal',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
    });
  }

  private async suspendPastGraceSubscriptions(now: Date): Promise<number> {
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - RENEWAL_GRACE_PERIOD_DAYS);
    const toSuspend = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.PAST_DUE, nextBillingDate: LessThan(graceCutoff) },
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

  private async finalizeScheduledCancellations(now: Date): Promise<void> {
    await this.subscriptionRepo
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.CANCELLED, cancelledAt: now, cancelAtPeriodEnd: false })
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
    await this.recordBillingEvent(`renewal_failed_${reference}`, 'renewal_failed', {
      tenantId: subscription.tenantId,
      reason: mapped.code,
    });
    const tenant = await this.tenantRepo.findOne({
      where: { id: subscription.tenantId },
      relations: ['createdBy'],
    });
    if (tenant) subscription.tenant = tenant;
    await this.notifyRenewalIssue(subscription, 'PAST_DUE', mapped.message);
  }

  private async verifyPaymentReference(
    reference: string,
    provider: BillingProvider,
  ): Promise<{ status?: string; paid?: boolean; amount?: number } | null> {
    if (provider === BillingProvider.MONNIFY) return this.monnifyApi.verifyTransaction(reference);
    if (provider !== BillingProvider.NOMBA) return { status: 'success', amount: 0 };
    return (await this.nombaApi.verifyTransaction(reference)) ?? null;
  }

  private requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA || provider === BillingProvider.MONNIFY;
  }

  private async updateRenewalPeriodClaim(
    periodEventId: string,
    patch: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    const existing = await this.billingEventRepo.findOne({
      where: { eventId: periodEventId, provider },
    });
    if (existing) {
      existing.payload = { ...(existing.payload ?? {}), ...patch };
      await this.billingEventRepo.save(existing);
      return;
    }
    await this.recordBillingEvent(periodEventId, 'renewal_period', patch, provider);
  }

  private async recordBillingEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (await this.billingEventRepo.findOne({ where: { eventId, provider } })) return;
    await this.billingEventRepo.save(
      this.billingEventRepo.create({ eventId, provider, eventType, payload }),
    );
  }

  private async resolveBillingEmail(
    tenantId: string,
    fallback?: string | null,
  ): Promise<string | null> {
    try {
      const s = await this.tenantSettingsService.getTenantSettings(tenantId);
      return s.settings.billing?.contactEmail?.trim() || fallback?.trim() || null;
    } catch {
      return fallback?.trim() || null;
    }
  }
}
