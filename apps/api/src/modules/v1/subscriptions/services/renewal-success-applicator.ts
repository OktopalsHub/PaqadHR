import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookPayment } from '../interfaces/subscription-billing.interface';
import { advanceBillingPeriod } from '../utils/billing-utils';
import { resolveSettledAmount } from '../utils/settled-amount.util';
import { BillingEventStore } from './billing-event-store';
import { RenewalLifecycleService } from './renewal-lifecycle.service';
import { SeatPricingCalculator } from './seat-pricing-calculator';

@Injectable()
export class RenewalSuccessApplicator {
  private readonly logger = new Logger(RenewalSuccessApplicator.name);

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
    // A subscription keeps billing in the currency it was created in, which adaptive
    // pricing may have made a local one. Validate in that currency so the recorded
    // figure is the amount actually charged, not the plan's currency restated.
    const paidCurrency = payment.currency?.toUpperCase();
    const settled = resolveSettledAmount({
      paidAmount: payment.amount ?? 0,
      paidCurrency: payment.currency,
      planPrice,
      planPriceInPaidCurrency:
        paidCurrency && paidCurrency !== planPrice.currency.toUpperCase()
          ? await this.plansService.getActivePlanPriceForCurrency(planPrice.planId, paidCurrency)
          : null,
      seatCount: chargedSeatCount,
    });
    if (settled.basis === 'provider_reported') {
      this.logger.warn(
        `Renewal settled in unpriced currency ${settled.currency}: ${settled.amount} ` +
          `tenant=${tenantId} plan=${planPrice.planId} (price row is ${planPrice.currency}). ` +
          'Accepted on provider conversion — no local row to reconcile.',
      );
    }

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
          amount: settled.amount,
          currency: settled.currency,
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

  async getRenewalPeriodClaimStatus(
    periodEventId: string,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<string | undefined> {
    const billingEventRepo = this.dataSource.getRepository(BillingEvent);
    const existing = await billingEventRepo.findOne({
      where: { eventId: periodEventId, provider },
    });
    return (existing?.payload as { status?: string } | undefined)?.status;
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
