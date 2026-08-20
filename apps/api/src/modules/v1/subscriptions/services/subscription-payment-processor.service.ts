import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import {
  BillingChargeType,
  CARD_UPDATE_VERIFY_AMOUNT,
  RENEWAL_PENDING_CLAIM_TTL_MS,
} from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type {
  SubscriptionWebhookPayment,
} from '../interfaces/subscription-billing.interface';
import {
  calculatePerSeatTotal,
  calculateProratedSeatCharge,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NombaApiService } from './nomba-api.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Handles payment processing for different billing charge types.
 * Processes initial payments, renewals, card updates, and quantity updates.
 */
@Injectable()
export class SubscriptionPaymentProcessorService {
  private readonly logger = new Logger(SubscriptionPaymentProcessorService.name);

  constructor(
    private readonly nombaApi: NombaApiService,
    private readonly monnifyApi: MonnifyApiService,
    private readonly plansService: PlansService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepository: Repository<BillingEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async verifyPaymentReference(reference: string, provider: BillingProvider) {
    if (provider === BillingProvider.MONNIFY) {
      const verified = await this.monnifyApi.verifyTransaction(reference);
      return verified
        ? { status: verified.paid ? 'success' : 'pending', amount: verified.amount }
        : { status: 'pending', amount: 0 };
    }
    if (provider !== BillingProvider.NOMBA) {
      return { status: 'success', amount: 0 };
    }
    return this.nombaApi.verifyTransaction(reference);
  }

  private requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA || provider === BillingProvider.MONNIFY;
  }

  private requiresCardToken(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA;
  }

  async hasProcessedEvent(eventId: string, provider?: BillingProvider): Promise<boolean> {
    if (provider) {
      return this.billingEventRepository.exists({
        where: { eventId, billingProvider: provider },
      });
    }
    return this.billingEventRepository.exists({ where: { eventId } });
  }

  async recordBillingEvent(
    eventId: string,
    eventType: string,
    data: Record<string, unknown>,
    provider?: BillingProvider,
  ): Promise<void> {
    const existing = await this.hasProcessedEvent(eventId, provider);
    if (existing) {
      return;
    }
    const event = this.billingEventRepository.create({
      eventId,
      eventType,
      billingProvider: provider,
      eventData: data,
      processedAt: new Date(),
    });
    await this.billingEventRepository.save(event);
  }

  private resetDunningFields(subscription: TenantSubscription): void {
    subscription.dunningAttemptCount = 0;
    subscription.dunningNextRetryAt = null;
    subscription.lastPaymentFailureReason = null;
    subscription.lastPaymentFailureDetail = null;
  }

  private applyPaymentMethodFromWebhook(
    subscription: TenantSubscription,
    payment: SubscriptionWebhookPayment,
  ): void {
    if (payment.tokenKey?.trim()) {
      subscription.paymentMethodId = payment.tokenKey;
    }
    if (payment.cardBrand) {
      subscription.paymentMethodBrand = payment.cardBrand;
    }
    if (payment.cardLastFour) {
      subscription.paymentMethodLastFour = payment.cardLastFour;
    }
  }

  private advanceBillingPeriod(anchor: Date): { periodStart: Date; periodEnd: Date } {
    const periodStart = new Date(anchor);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return { periodStart, periodEnd };
  }

  private resolveBillingPeriod(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
    billingPeriodAnchor?: Date,
  ): { periodStart: Date; periodEnd: Date; nextBillingDate: Date } {
    const nextFromProvider = payment.nextBillingDate ? new Date(payment.nextBillingDate) : null;
    const endFromProvider = payment.currentPeriodEnd ? new Date(payment.currentPeriodEnd) : null;
    const startFromProvider = payment.currentPeriodStart
      ? new Date(payment.currentPeriodStart)
      : null;

    if (nextFromProvider && !Number.isNaN(nextFromProvider.getTime())) {
      const periodStart =
        startFromProvider && !Number.isNaN(startFromProvider.getTime())
          ? startFromProvider
          : new Date(billingPeriodAnchor ?? subscription.nextBillingDate);
      const periodEnd =
        endFromProvider && !Number.isNaN(endFromProvider.getTime())
          ? endFromProvider
          : nextFromProvider;
      return { periodStart, periodEnd, nextBillingDate: nextFromProvider };
    }

    const periodStart = new Date(billingPeriodAnchor ?? subscription.nextBillingDate);
    const { periodEnd } = this.advanceBillingPeriod(periodStart);
    return { periodStart, periodEnd, nextBillingDate: periodEnd };
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });
    return resolveSeatCount(count);
  }

  async processInitialPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId, provider)) {
      return;
    }

    if (!payment.planPriceId || !payment.planId) {
      throw new BadRequestException('Webhook missing plan metadata');
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Payment could not be verified with billing provider');
    }

    const planPrice = await this.plansService.getPlanPriceById(payment.planPriceId);
    if (!planPrice?.isActive || planPrice.planId !== payment.planId) {
      throw new BadRequestException('Webhook plan metadata does not match records');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: payment.tenantId } });
    if (!tenant) {
      throw new BadRequestException('Unknown tenant in webhook metadata');
    }

    const seatCount = resolveSeatCount(
      payment.quantity ?? (await this.getTenantSeatCount(payment.tenantId)),
    );
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      this.logger.error(
        `Amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Payment amount does not match server quote');
    }

    if (this.requiresCardToken(provider) && !payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token for subscription billing');
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, billingProvider: provider },
      });
      if (existing) return;

      const subscriptionRepo = manager.getRepository(TenantSubscription);
      let subscription = await subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });

      const now = new Date();
      const isFirstPaidActivation =
        !subscription ||
        subscription.status === SubscriptionStatus.TRIAL ||
        subscription.status === SubscriptionStatus.INACTIVE ||
        subscription.status === SubscriptionStatus.EXPIRED;

      let periodStart: Date;
      let periodEnd: Date;
      let nextBillingDate: Date;

      if (isManagedSubscriptionProvider(provider) && payment.nextBillingDate) {
        const resolved = this.resolveBillingPeriod(
          payment,
          subscription ?? ({ nextBillingDate: now } as TenantSubscription),
        );
        periodStart = resolved.periodStart;
        periodEnd = resolved.periodEnd;
        nextBillingDate = resolved.nextBillingDate;
      } else {
        const advanced = isFirstPaidActivation
          ? this.advanceBillingPeriod(now)
          : this.advanceBillingPeriod(
              subscription!.nextBillingDate <= now ? subscription!.nextBillingDate : now,
            );
        periodStart = advanced.periodStart;
        periodEnd = advanced.periodEnd;
        nextBillingDate = periodEnd;
      }

      if (!subscription) {
        subscription = subscriptionRepo.create({
          tenantId: payment.tenantId,
          planId: planPrice.planId,
          planPriceId: planPrice.id,
          status: SubscriptionStatus.ACTIVE,
          currentUsers: seatCount,
          trialEndsAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate,
          nombaSubscriptionId: provider === BillingProvider.NOMBA ? payment.reference : null,
          billingProvider: provider,
          externalSubscriptionId: payment.externalSubscriptionId ?? null,
          paymentMethodId: payment.tokenKey ?? payment.externalSubscriptionId ?? null,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          usageMetrics: {},
          billingHistory: [],
        });
        this.applyPaymentMethodFromWebhook(subscription, payment);
        this.resetDunningFields(subscription);
      } else {
        subscription.planId = planPrice.planId;
        subscription.planPriceId = planPrice.id;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.currentUsers = seatCount;
        subscription.trialEndsAt = null;
        subscription.currentPeriodStart = periodStart;
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingDate = nextBillingDate;
        subscription.nombaSubscriptionId =
          provider === BillingProvider.NOMBA ? payment.reference : subscription.nombaSubscriptionId;
        subscription.billingProvider = provider;
        subscription.externalSubscriptionId =
          payment.externalSubscriptionId ?? subscription.externalSubscriptionId;
        subscription.paymentMethodId =
          payment.tokenKey ?? payment.externalSubscriptionId ?? subscription.paymentMethodId;
        subscription.cancelAtPeriodEnd = false;
        subscription.cancelledAt = null;
        subscription.cancellationReason = null;
        this.applyPaymentMethodFromWebhook(subscription, payment);
        this.resetDunningFields(subscription);
      }

      subscription.billingHistory = [
        ...(subscription.billingHistory ?? []),
        {
          date: now,
          amount: normalizedPaid,
          currency: payment.currency,
          status: 'paid' as const,
          invoiceId: payment.reference,
        },
      ];

      await subscriptionRepo.save(subscription);
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: payment.eventId,
          billingProvider: provider,
          eventType: 'payment_success',
          eventData: payment as unknown as Record<string, unknown>,
        }),
      );
    });
  }

  async processCardUpdateSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !UUID_PATTERN.test(payment.tenantId) ||
      (await this.hasProcessedEvent(payment.eventId, provider))
    ) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Card update payment could not be verified');
    }

    if (!payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token from card update webhook');
    }

    if (
      !Number.isFinite(payment.amount) ||
      !isAmountWithinTolerance(payment.amount, CARD_UPDATE_VERIFY_AMOUNT)
    ) {
      throw new BadRequestException('Card update amount does not match verification charge');
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found for card update');
    }

    this.applyPaymentMethodFromWebhook(subscription, payment);
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      this.resetDunningFields(subscription);
    }

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      payment.eventId,
      'card_update_success',
      {
        tenantId: payment.tenantId,
        reference: payment.reference,
      },
      provider,
    );
  }

  async processRenewalPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId, provider)) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Renewal payment could not be verified');
    }

    // Renewal success will be handled by the renewal service
    await this.recordBillingEvent(
      payment.eventId,
      'renewal_payment_success',
      payment as unknown as Record<string, unknown>,
      provider,
    );
  }

  async processQuantityUpdatePaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!payment.reference || (await this.hasProcessedEvent(payment.eventId, provider))) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['planPrice'],
    });
    if (!subscription) {
      return;
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice) {
      this.logger.warn(
        `Quantity update webhook for tenant ${payment.tenantId}: plan price not found`,
      );
      return;
    }

    const targetSeatCount = resolveSeatCount(
      payment.targetSeatCount ??
        payment.quantity ??
        subscription.usageMetrics?.pendingSeatCount ??
        subscription.currentUsers,
    );
    const extraSeats =
      payment.extraSeats ??
      subscription.usageMetrics?.pendingExtraSeats ??
      Math.max(0, targetSeatCount - subscription.currentUsers);

    const expectedAmount =
      subscription.usageMetrics?.pendingChargeAmount ??
      calculateProratedSeatCharge(
        planPrice,
        extraSeats,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
      ).amount;

    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      this.logger.error(
        `Quantity update amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Seat addition payment amount does not match server quote');
    }

    subscription.currentUsers = targetSeatCount;
    subscription.usageMetrics = {
      ...(subscription.usageMetrics ?? {}),
      pendingSeatCount: undefined,
      pendingExtraSeats: undefined,
      pendingChargeAmount: undefined,
      pendingSeatChargedAt: undefined,
    };

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      payment.eventId,
      'quantity_update_success',
      {
        ...payment,
        quantity: targetSeatCount,
        extraSeats,
      } as unknown as Record<string, unknown>,
      provider,
    );
  }

  async processPaymentFailed(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !UUID_PATTERN.test(payment.tenantId) ||
      (await this.hasProcessedEvent(payment.eventId, provider))
    ) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['tenant', 'tenant.createdBy', 'planPrice'],
    });
    if (!subscription) {
      return;
    }

    if (payment.billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE) {
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      await this.subscriptionRepository.save(subscription);
      await this.recordBillingEvent(
        payment.eventId,
        'quantity_update_failed',
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
}
