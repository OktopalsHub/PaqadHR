import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Brackets, Repository } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PlansService } from '../../plans/services/plans.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookPayment } from '../interfaces/subscription-billing.interface';
import { maxDunningAttempts } from '../utils/dunning.util';
import { calculatePerSeatTotal, normalizeWebhookAmount } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { PaymentVerifier } from './payment-verifier';
import { RenewalLifecycleService } from './renewal-lifecycle.service';
import { RenewalSuccessApplicator } from './renewal-success-applicator';
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
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly seatPricing: SeatPricingCalculator,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly paymentVerifier: PaymentVerifier,
    private readonly renewalLifecycle: RenewalLifecycleService,
    private readonly renewalSuccess: RenewalSuccessApplicator,
    readonly _notificationHelper?: NotificationHelperService,
  ) {}

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) return result;
    const now = new Date();
    await this.seatPricing.reclaimStuckPendingSeatCharges();
    result.suspended = await this.renewalLifecycle.suspendPastGraceSubscriptions(now);
    await this.renewalLifecycle.finalizeScheduledCancellations(now);

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

    const claimStatus = await this.renewalSuccess.getRenewalPeriodClaimStatus(
      periodEventId,
      billingProviderEnum,
    );
    if (claimStatus === 'pending' || claimStatus === 'charged' || claimStatus === 'success') {
      this.logger.warn(
        `Skipping renewal for ${subscription.tenantId}; period claim already ${claimStatus}`,
      );
      return 'skipped';
    }

    await this.renewalSuccess.updateRenewalPeriodClaim(
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
      await this.renewalSuccess.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'charged', orderReference: charge.orderReference || orderReference },
        billingProviderEnum,
      );

      const verified = await this.paymentVerifier.verifyPaymentReference(
        charge.orderReference,
        billingProviderEnum,
      );
      if (
        !verified ||
        (this.paymentVerifier.requiresProviderVerification(billingProviderEnum) &&
          !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
      ) {
        await this.renewalSuccess.updateRenewalPeriodClaim(
          periodEventId,
          { status: 'failed', orderReference: charge.orderReference, failed: true, attemptCount },
          billingProviderEnum,
        );
        await this.renewalLifecycle.markRenewalFailed(
          subscription,
          charge.orderReference,
          'verification_failed',
        );
        return 'failed';
      }

      const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
      const normalizedPaid = normalizeWebhookAmount(
        Number(verified.amount ?? 0),
        expectedAmount,
        planPrice.currency,
      );
      await this.renewalSuccess.applyRenewalSuccess(
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
      await this.renewalSuccess.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'success', orderReference: charge.orderReference },
        billingProviderEnum,
      );
      return 'charged';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Renewal charge failed for ${subscription.tenantId}: ${message}`);
      await this.renewalSuccess.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'failed', failed: true, attemptCount, detail: message },
        billingProviderEnum,
      );
      await this.renewalLifecycle.markRenewalFailed(subscription, periodEventId, message);
      return 'failed';
    }
  }

  renewalPeriodEventId(subscriptionId: string, billingDate: Date): string {
    return `renewal_period_${subscriptionId}_${billingDate.toISOString()}`;
  }

  buildNombaRenewalOrderReference(subscriptionId: string, billingDate: Date): string {
    return `sub_ren_${subscriptionId.replace(/-/g, '').slice(0, 24)}_${billingDate.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }

  async applyRenewalSuccess(
    tenantId: string,
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
    billingPeriodAnchor?: Date,
    attemptCount = 0,
  ): Promise<void> {
    return this.renewalSuccess.applyRenewalSuccess(
      tenantId,
      payment,
      provider,
      billingPeriodAnchor,
      attemptCount,
    );
  }

  async markRenewalFailed(
    subscription: TenantSubscription,
    reference: string,
    reason: string,
  ): Promise<void> {
    return this.renewalLifecycle.markRenewalFailed(subscription, reference, reason);
  }

  resetDunningFields(subscription: TenantSubscription): void {
    this.renewalLifecycle.resetDunningFields(subscription);
  }

  async lapseStaleSubscriptions(): Promise<{ lapsed: number }> {
    return this.renewalLifecycle.lapseStaleSubscriptions();
  }

  async lapseStaleBachsSubscriptions() {
    return this.renewalLifecycle.lapseStaleBachsSubscriptions();
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
