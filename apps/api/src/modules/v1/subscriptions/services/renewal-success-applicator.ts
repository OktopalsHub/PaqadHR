import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookPayment } from '../interfaces/subscription-billing.interface';
import { advanceBillingPeriod } from '../utils/billing-utils';
import { calculatePerSeatTotal, normalizeWebhookAmount } from '../utils/per-seat-pricing.util';
import { BillingEventStore } from './billing-event-store';
import { RenewalLifecycleService } from './renewal-lifecycle.service';
import { SeatPricingCalculator } from './seat-pricing-calculator';

@Injectable()
export class RenewalSuccessApplicator {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    private readonly plansService: PlansService,
    private readonly seatPricing: SeatPricingCalculator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly billingEventStore: BillingEventStore,
    private readonly renewalLifecycle: RenewalLifecycleService,
  ) {}

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
    const pe = advanceBillingPeriod(ps).periodEnd;
    return { periodStart: ps, periodEnd: pe, nextBillingDate: pe };
  }

  async applyRenewalSuccess(
    tenantId: string,
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
    billingPeriodAnchor?: Date,
    _attemptCount = 0,
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
            ...advanceBillingPeriod(billingPeriodAnchor ?? locked.nextBillingDate),
            nextBillingDate: advanceBillingPeriod(billingPeriodAnchor ?? locked.nextBillingDate)
              .periodEnd,
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
      this.renewalLifecycle.resetDunningFields(locked);
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

  async updateRenewalPeriodClaim(
    periodEventId: string,
    patch: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    const billingEventRepo = this.dataSource.getRepository(BillingEvent);
    const existing = await billingEventRepo.findOne({
      where: { eventId: periodEventId, provider },
    });
    if (existing) {
      existing.payload = { ...(existing.payload ?? {}), ...patch };
      await billingEventRepo.save(existing);
      return;
    }
    await this.billingEventStore.recordBillingEvent(
      periodEventId,
      'renewal_period',
      patch,
      provider,
    );
  }
}
