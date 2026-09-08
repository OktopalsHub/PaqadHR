import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { MonnifyApiService } from '../../../../common/services/monnify-api.service';
import { PlansService } from '../../plans/services/plans.service';
import { BillingChargeType, CARD_UPDATE_VERIFY_AMOUNT } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type {
  SubscriptionWebhookEvent,
  SubscriptionWebhookPayment,
} from '../interfaces/subscription-billing.interface';
import {
  calculatePerSeatTotal,
  calculateProratedSeatCharge,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { NombaApiService } from './nomba-api.service';
import { RenewalProcessor } from './renewal-processor';
import { SeatPricingCalculator } from './seat-pricing-calculator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    @InjectRepository(BillingEvent) private readonly billingEventRepo: Repository<BillingEvent>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly monnifyApi: MonnifyApiService,
    private readonly nombaApi: NombaApiService,
    private readonly renewalProcessor: RenewalProcessor,
    private readonly seatPricing: SeatPricingCalculator,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  async processBillingPayload(
    payload: unknown,
    provider: BillingProvider,
  ): Promise<{ received: boolean }> {
    const billingProvider = this.billingProviderFactory.getProviderByEnum(provider);
    const event = billingProvider.parseWebhook(payload);
    if (!event || event.kind === 'ignored') return { received: true };

    let subscription = await this.resolveWebhookSubscription(event);
    if ((event.kind === 'payment.success' || event.kind === 'payment.failed') && subscription) {
      this.enrichPaymentFromSubscription(event.payment, subscription);
    }

    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID.test(tenantId) && !subscription) {
      subscription = await this.subscriptionRepo.findOne({ where: { tenantId } });
    }
    if (
      tenantId &&
      UUID.test(tenantId) &&
      this.isStaleProviderWebhook(event, subscription, provider)
    ) {
      this.logger.warn(
        `Ignoring ${event.kind} from ${provider} for ${tenantId}; active provider is ${subscription?.billingProvider}`,
      );
      return { received: true };
    }

    if (event.kind === 'payment.success') {
      let billingType = event.payment.billingType;
      const hasPaidHistory = (subscription?.billingHistory?.length ?? 0) > 0;
      if (
        billingType === BillingChargeType.SUBSCRIPTION &&
        subscription?.status === SubscriptionStatus.ACTIVE &&
        subscription.externalSubscriptionId?.trim() &&
        isManagedSubscriptionProvider(provider) &&
        hasPaidHistory &&
        subscription.nextBillingDate <= new Date()
      ) {
        billingType = BillingChargeType.SUBSCRIPTION_RENEWAL;
      }
      if (billingType === BillingChargeType.SUBSCRIPTION_RENEWAL)
        await this.processRenewalPaymentSuccess(event.payment, provider);
      else if (billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE)
        await this.processQuantityUpdatePaymentSuccess(event.payment, provider);
      else if (billingType === BillingChargeType.CARD_UPDATE)
        await this.processCardUpdateSuccess(event.payment, provider);
      else await this.processInitialPaymentSuccess(event.payment, provider);
    }
    if (event.kind === 'payment.failed') await this.processPaymentFailed(event.payment, provider);
    if (event.kind === 'subscription.created')
      await this.processExternalSubscriptionCreated(event, provider);
    if (event.kind === 'subscription.cancelled')
      await this.processExternalSubscriptionCancelled(event, provider);
    return { received: true };
  }

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) throw new UnauthorizedException('Missing webhook signature');
    if (
      !this.billingProviderFactory.getNombaProvider().verifyWebhookSignature(rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
    return this.processBillingPayload(payload, BillingProvider.NOMBA);
  }

  processNombaPayload(payload: unknown) {
    return this.processBillingPayload(payload, BillingProvider.NOMBA);
  }
  processBachsPayload(payload: unknown) {
    return this.processBillingPayload(payload, BillingProvider.BACHS);
  }
  processPolarPayload(payload: unknown) {
    return this.processBillingPayload(payload, BillingProvider.POLAR);
  }
  processMonnifyPayload(payload: unknown) {
    return this.processBillingPayload(payload, BillingProvider.MONNIFY);
  }

  private resolveWebhookTenantId(event: SubscriptionWebhookEvent): string | null {
    if (event.kind === 'subscription.created' || event.kind === 'subscription.cancelled')
      return event.tenantId;
    if (event.kind === 'payment.success' || event.kind === 'payment.failed')
      return event.payment.tenantId;
    return null;
  }

  private isTrialInitialCheckoutWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription,
  ): boolean {
    return (
      subscription.status === SubscriptionStatus.TRIAL &&
      event.kind === 'payment.success' &&
      event.payment.billingType === BillingChargeType.SUBSCRIPTION
    );
  }

  private isStaleProviderWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription | null,
    webhookProvider: BillingProvider,
  ): boolean {
    if (!subscription?.billingProvider || subscription.billingProvider === webhookProvider)
      return false;
    if (this.isTrialInitialCheckoutWebhook(event, subscription)) return false;
    return true;
  }

  private async resolveWebhookSubscription(
    event: SubscriptionWebhookEvent,
  ): Promise<TenantSubscription | null> {
    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID.test(tenantId))
      return this.subscriptionRepo.findOne({ where: { tenantId } });
    const externalId =
      event.kind === 'payment.success' || event.kind === 'payment.failed'
        ? event.payment.externalSubscriptionId?.trim()
        : event.kind === 'subscription.created' || event.kind === 'subscription.cancelled'
          ? event.externalSubscriptionId?.trim()
          : undefined;
    return externalId
      ? this.subscriptionRepo.findOne({ where: { externalSubscriptionId: externalId } })
      : null;
  }

  private enrichPaymentFromSubscription(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
  ): void {
    if (!payment.tenantId?.trim() || !UUID.test(payment.tenantId))
      payment.tenantId = subscription.tenantId;
    if (!payment.planId?.trim()) payment.planId = subscription.planId;
    if (!payment.planPriceId?.trim()) payment.planPriceId = subscription.planPriceId;
    if (payment.quantity == null && subscription.currentUsers != null)
      payment.quantity = subscription.currentUsers;
    if (!payment.externalSubscriptionId?.trim() && subscription.externalSubscriptionId)
      payment.externalSubscriptionId = subscription.externalSubscriptionId;
  }

  private async processInitialPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID.test(payment.tenantId) || (await this.hasProcessedEvent(payment.eventId, provider)))
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
      await this.recordBillingEvent(
        payment.eventId,
        'payment_success_skipped',
        { tenantId: payment.tenantId, reason: 'already_paid' },
        provider,
      );
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
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
        ? this.advanceBillingPeriod(now)
        : this.advanceBillingPeriod(sub!.nextBillingDate <= now ? sub!.nextBillingDate : now);

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

  private async processRenewalPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID.test(payment.tenantId) || (await this.hasProcessedEvent(payment.eventId, provider)))
      return;
    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified ||
        !isNoahPaymentVerified(verified.status ?? (verified.paid ? 'success' : 'pending')))
    )
      throw new BadRequestException('Renewal not verified');
    await this.renewalProcessor.applyRenewalSuccess(payment.tenantId, payment, provider);
  }

  private async processQuantityUpdatePaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!payment.reference || (await this.hasProcessedEvent(payment.eventId, provider))) return;
    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
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
    await this.recordBillingEvent(
      payment.eventId,
      'quantity_update_success',
      { ...payment, quantity: targetSeats } as unknown as Record<string, unknown>,
      provider,
    );
  }

  private async processCardUpdateSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID.test(payment.tenantId) || (await this.hasProcessedEvent(payment.eventId, provider)))
      return;
    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
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
    await this.recordBillingEvent(
      payment.eventId,
      'card_update_success',
      { tenantId: payment.tenantId, reference: payment.reference },
      provider,
    );
  }

  private async processPaymentFailed(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID.test(payment.tenantId) || (await this.hasProcessedEvent(payment.eventId, provider)))
      return;
    const sub = await this.subscriptionRepo.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['tenant', 'tenant.createdBy', 'planPrice'],
    });
    if (!sub) return;
    if (payment.billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE) {
      sub.usageMetrics = {
        ...(sub.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      await this.subscriptionRepo.save(sub);
      await this.recordBillingEvent(
        payment.eventId,
        'quantity_update_failed',
        payment as unknown as Record<string, unknown>,
        provider,
      );
      return;
    }
    if (payment.billingType === BillingChargeType.SUBSCRIPTION_RENEWAL) {
      await this.renewalProcessor.markRenewalFailed(
        sub,
        payment.reference,
        'renewal_payment_failed',
      );
      await this.recordBillingEvent(
        payment.eventId,
        'renewal_failed_webhook',
        payment as unknown as Record<string, unknown>,
        provider,
      );
      return;
    }
    await this.recordBillingEvent(
      payment.eventId,
      'payment_failed',
      payment as unknown as Record<string, unknown>,
      provider,
    );
  }

  private async processExternalSubscriptionCreated(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.created' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) return;
    const sub = await this.subscriptionRepo.findOne({ where: { tenantId: event.tenantId } });
    if (!sub) return;
    if (
      sub.billingProvider !== provider &&
      sub.status !== SubscriptionStatus.TRIAL &&
      sub.externalSubscriptionId?.trim()
    )
      return;
    sub.externalSubscriptionId = event.externalSubscriptionId;
    sub.billingProvider = provider;
    if (event.planPriceId && event.planId) {
      const pp = await this.plansService.getPlanPriceById(event.planPriceId);
      if (pp?.isActive && pp.planId === event.planId) {
        sub.planId = pp.planId;
        sub.planPriceId = pp.id;
      }
    }
    if (event.quantity != null) sub.currentUsers = resolveSeatCount(event.quantity);
    const hasPlan = !!event.planId && !!event.planPriceId;
    if (hasPlan) {
      sub.status = SubscriptionStatus.ACTIVE;
      sub.trialEndsAt = null;
      sub.cancelAtPeriodEnd = false;
      sub.cancelledAt = null;
    }
    await this.subscriptionRepo.save(sub);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_created',
      { tenantId: event.tenantId, externalSubscriptionId: event.externalSubscriptionId },
      provider,
    );
    if (hasPlan && sub.status === SubscriptionStatus.ACTIVE)
      this.productAnalytics.capture('system', 'subscription_activated', {
        tenantId: event.tenantId,
      });
  }

  private async processExternalSubscriptionCancelled(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.cancelled' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) return;
    let sub =
      event.tenantId && UUID.test(event.tenantId)
        ? await this.subscriptionRepo.findOne({ where: { tenantId: event.tenantId } })
        : null;
    if (!sub && event.externalSubscriptionId?.trim())
      sub = await this.subscriptionRepo.findOne({
        where: { externalSubscriptionId: event.externalSubscriptionId.trim() },
      });
    if (!sub || sub.billingProvider !== provider) return;
    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    sub.cancelAtPeriodEnd = false;
    await this.subscriptionRepo.save(sub);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_cancelled',
      { tenantId: sub.tenantId, externalSubscriptionId: event.externalSubscriptionId },
      provider,
    );
  }

  private advanceBillingPeriod(anchor: Date) {
    const s = new Date(anchor);
    const e = new Date(s);
    e.setMonth(e.getMonth() + 1);
    return { periodStart: s, periodEnd: e };
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

  private async hasProcessedEvent(eventId: string, provider?: BillingProvider): Promise<boolean> {
    return provider
      ? this.billingEventRepo.exists({ where: { eventId, provider } })
      : this.billingEventRepo.exists({ where: { eventId } });
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
}
