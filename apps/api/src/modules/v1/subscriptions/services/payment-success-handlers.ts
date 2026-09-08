import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { BillingChargeType, CARD_UPDATE_VERIFY_AMOUNT } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookPayment } from '../interfaces/subscription-billing.interface';
import { advanceBillingPeriod, isValidUuid } from '../utils/billing-utils';
import {
  calculatePerSeatTotal,
  calculateProratedSeatCharge,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { BillingEventStore } from './billing-event-store';
import { PaymentVerifier } from './payment-verifier';
import { RenewalProcessor } from './renewal-processor';
import { SeatPricingCalculator } from './seat-pricing-calculator';

@Injectable()
export class PaymentSuccessHandlers {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly plansService: PlansService,
    private readonly seatPricing: SeatPricingCalculator,
    private readonly renewalProcessor: RenewalProcessor,
    private readonly billingEventStore: BillingEventStore,
    private readonly paymentVerifier: PaymentVerifier,
  ) {}

  async processInitialPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !isValidUuid(payment.tenantId) ||
      (await this.billingEventStore.hasProcessedEvent(payment.eventId, provider))
    )
      return;
    if (!payment.planPriceId || !payment.planId)
      throw new BadRequestException('Webhook missing plan metadata');

    const existing = await this.subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });
    if (
      existing?.status === SubscriptionStatus.ACTIVE &&
      existing.nextBillingDate > new Date() &&
      existing.planId === payment.planId &&
      existing.planPriceId === payment.planPriceId
    ) {
      await this.billingEventStore.recordBillingEvent(
        payment.eventId,
        'payment_success_skipped',
        { tenantId: payment.tenantId, reason: 'already_paid' },
        provider,
      );
      return;
    }

    const verified = await this.paymentVerifier.verifyPaymentReference(payment.reference, provider);
    if (
      this.paymentVerifier.requiresProviderVerification(provider) &&
      (!verified ||
        !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
    )
      throw new BadRequestException('Payment not verified');

    const planPrice = await this.plansService.getPlanPriceById(payment.planPriceId);
    if (!planPrice?.isActive || planPrice.planId !== payment.planId)
      throw new BadRequestException('Plan metadata mismatch');

    const seatCount = resolveSeatCount(
      payment.quantity ?? (await this.seatPricing.getTenantSeatCount(payment.tenantId)),
    );
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const _normalizedPaid = normalizeWebhookAmount(
      payment.amount,
      expectedAmount,
      payment.currency,
    );

    if (
      existing &&
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(existing.status) &&
      existing.nextBillingDate <= new Date()
    ) {
      await this.renewalProcessor.applyRenewalSuccess(
        payment.tenantId,
        { ...payment, billingType: BillingChargeType.SUBSCRIPTION_RENEWAL },
        provider,
        existing.nextBillingDate,
      );
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      if (await billingEventRepo.findOne({ where: { eventId: payment.eventId, provider } })) return;
      const subscriptionRepo = manager.getRepository(TenantSubscription);
      let sub = await subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });
      const now = new Date();
      const isFirstPaid =
        !sub ||
        sub.status === SubscriptionStatus.TRIAL ||
        sub.status === SubscriptionStatus.INACTIVE;
      const advanced = isFirstPaid
        ? advanceBillingPeriod(now)
        : advanceBillingPeriod(sub!.nextBillingDate <= now ? sub!.nextBillingDate : now);

      if (!sub) {
        sub = subscriptionRepo.create({
          tenantId: payment.tenantId,
          planId: planPrice.planId,
          planPriceId: planPrice.id,
          status: SubscriptionStatus.ACTIVE,
          currentUsers: seatCount,
          currentPeriodStart: advanced.periodStart,
          currentPeriodEnd: advanced.periodEnd,
          nextBillingDate: advanced.periodEnd,
          nombaSubscriptionId: provider === BillingProvider.NOMBA ? payment.reference : null,
          billingProvider: provider,
          externalSubscriptionId: payment.externalSubscriptionId ?? null,
          paymentMethodId: payment.tokenKey ?? payment.externalSubscriptionId ?? null,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          usageMetrics: {},
          billingHistory: [],
        });
      } else {
        sub.planId = planPrice.planId;
        sub.planPriceId = planPrice.id;
        sub.status = SubscriptionStatus.ACTIVE;
        sub.currentUsers = seatCount;
        sub.trialEndsAt = null;
        sub.currentPeriodStart = advanced.periodStart;
        sub.currentPeriodEnd = advanced.periodEnd;
        sub.nextBillingDate = advanced.periodEnd;
        sub.billingProvider = provider;
        sub.cancelAtPeriodEnd = false;
        sub.cancelledAt = null;
        if (payment.tokenKey?.trim()) sub.paymentMethodId = payment.tokenKey;
      }
      sub.billingHistory = [
        ...(sub.billingHistory ?? []),
        {
          date: now,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: 'paid' as const,
          invoiceId: payment.reference,
        },
      ];
      await subscriptionRepo.save(sub);
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: payment.eventId,
          provider,
          eventType: 'payment_success',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
    });
  }

  async processRenewalPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !isValidUuid(payment.tenantId) ||
      (await this.billingEventStore.hasProcessedEvent(payment.eventId, provider))
    )
      return;
    const verified = await this.paymentVerifier.verifyPaymentReference(payment.reference, provider);
    if (
      this.paymentVerifier.requiresProviderVerification(provider) &&
      (!verified ||
        !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
    )
      throw new BadRequestException('Renewal not verified');
    await this.renewalProcessor.applyRenewalSuccess(payment.tenantId, payment, provider);
  }

  async processQuantityUpdatePaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !payment.reference ||
      (await this.billingEventStore.hasProcessedEvent(payment.eventId, provider))
    )
      return;
    const verified = await this.paymentVerifier.verifyPaymentReference(payment.reference, provider);
    if (
      this.paymentVerifier.requiresProviderVerification(provider) &&
      (!verified ||
        !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
    )
      return;
    const sub = await this.subscriptionRepo.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['planPrice'],
    });
    if (!sub) return;
    const planPrice = sub.planPrice ?? (await this.plansService.getPlanPriceById(sub.planPriceId));
    if (!planPrice) return;
    const targetSeats = resolveSeatCount(
      payment.targetSeatCount ?? payment.quantity ?? sub.currentUsers,
    );
    const extraSeats = payment.extraSeats ?? Math.max(0, targetSeats - sub.currentUsers);
    const expectedAmount =
      sub.usageMetrics?.pendingChargeAmount ??
      calculateProratedSeatCharge(
        planPrice,
        extraSeats,
        sub.currentPeriodStart,
        sub.currentPeriodEnd,
      ).amount;
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);
    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    )
      throw new BadRequestException('Seat amount mismatch');
    sub.currentUsers = targetSeats;
    sub.usageMetrics = {
      ...(sub.usageMetrics ?? {}),
      pendingSeatCount: undefined,
      pendingExtraSeats: undefined,
      pendingChargeAmount: undefined,
      pendingSeatChargedAt: undefined,
    };
    await this.subscriptionRepo.save(sub);
    await this.billingEventStore.recordBillingEvent(
      payment.eventId,
      'quantity_update_success',
      { ...payment, quantity: targetSeats } as unknown as Record<string, unknown>,
      provider,
    );
  }

  async processCardUpdateSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !isValidUuid(payment.tenantId) ||
      (await this.billingEventStore.hasProcessedEvent(payment.eventId, provider))
    )
      return;
    const verified = await this.paymentVerifier.verifyPaymentReference(payment.reference, provider);
    if (
      this.paymentVerifier.requiresProviderVerification(provider) &&
      (!verified ||
        !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
    )
      throw new BadRequestException('Card update not verified');
    if (!payment.tokenKey?.trim()) throw new BadRequestException('Missing card token');
    if (
      !Number.isFinite(payment.amount) ||
      !isAmountWithinTolerance(payment.amount, CARD_UPDATE_VERIFY_AMOUNT)
    )
      throw new BadRequestException('Card update amount mismatch');
    const sub = await this.subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (payment.tokenKey?.trim()) sub.paymentMethodId = payment.tokenKey;
    if (payment.cardBrand) sub.paymentMethodBrand = payment.cardBrand;
    if (payment.cardLastFour) sub.paymentMethodLastFour = payment.cardLastFour;
    if (sub.status === SubscriptionStatus.PAST_DUE) this.renewalProcessor.resetDunningFields(sub);
    await this.subscriptionRepo.save(sub);
    await this.billingEventStore.recordBillingEvent(
      payment.eventId,
      'card_update_success',
      { tenantId: payment.tenantId, reference: payment.reference },
      provider,
    );
  }
}
