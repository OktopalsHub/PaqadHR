import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type {
  SubscriptionWebhookEvent,
  SubscriptionWebhookPayment,
} from '../interfaces/subscription-billing.interface';
import { resolveSeatCount } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { SubscriptionPaymentProcessorService } from './subscription-payment-processor.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Handles webhook processing for all billing providers.
 * Routes webhooks to appropriate handlers based on event type.
 */
@Injectable()
export class SubscriptionWebhookService {
  private readonly logger = new Logger(SubscriptionWebhookService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepository: Repository<BillingEvent>,
  ) { }

  private resolveWebhookTenantId(event: SubscriptionWebhookEvent): string | null {
    if (event.kind === 'subscription.created' || event.kind === 'subscription.cancelled') {
      return event.tenantId;
    }
    if (event.kind === 'payment.success' || event.kind === 'payment.failed') {
      return event.payment.tenantId;
    }
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
    if (!subscription?.billingProvider) {
      return false;
    }
    if (subscription.billingProvider === webhookProvider) {
      return false;
    }
    // During trial, allow only the initial subscription checkout webhook from the provider
    // taking over. Follow-up webhooks like card updates must still come from the active provider.
    if (this.isTrialInitialCheckoutWebhook(event, subscription)) {
      return false;
    }
    return true;
  }

  private async resolveWebhookSubscription(
    event: SubscriptionWebhookEvent,
  ): Promise<TenantSubscription | null> {
    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID_PATTERN.test(tenantId)) {
      return this.subscriptionRepository.findOne({ where: { tenantId } });
    }

    const externalSubscriptionId =
      event.kind === 'payment.success' || event.kind === 'payment.failed'
        ? event.payment.externalSubscriptionId?.trim()
        : event.kind === 'subscription.created' || event.kind === 'subscription.cancelled'
          ? event.externalSubscriptionId?.trim()
          : undefined;
    if (!externalSubscriptionId) {
      return null;
    }

    return this.subscriptionRepository.findOne({
      where: { externalSubscriptionId },
    });
  }

  private enrichPaymentFromSubscription(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
  ): void {
    if (!payment.tenantId?.trim() || !UUID_PATTERN.test(payment.tenantId)) {
      payment.tenantId = subscription.tenantId;
    }
    if (!payment.planId?.trim()) {
      payment.planId = subscription.planId;
    }
    if (!payment.planPriceId?.trim()) {
      payment.planPriceId = subscription.planPriceId;
    }
    if (payment.quantity == null && subscription.currentUsers != null) {
      payment.quantity = subscription.currentUsers;
    }
    if (!payment.externalSubscriptionId?.trim() && subscription.externalSubscriptionId) {
      payment.externalSubscriptionId = subscription.externalSubscriptionId;
    }
  }

  async hasProcessedEvent(eventId: string, provider?: BillingProvider): Promise<boolean> {
    const exists = await this.billingEventRepository.findOne({
      where: { eventId, billingProvider: provider },
      select: ['id'],
    });
    return !!exists;
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

  private async endProviderTrialBestEffort(
    provider: BillingProvider,
    externalSubscriptionId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      await this.billingProviderFactory.endExternalTrial(provider, externalSubscriptionId);
      this.logger.log(
        `Ended ${provider} trial on ${externalSubscriptionId} for tenant ${tenantId} after paid checkout`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not end ${provider} trial on ${externalSubscriptionId} for tenant ${tenantId}: ${message}`,
      );
    }
  }

  async processExternalSubscriptionCreated(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.created' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: event.tenantId },
    });
    if (!subscription) {
      return;
    }
    if (
      subscription.billingProvider !== provider &&
      subscription.status !== SubscriptionStatus.TRIAL &&
      subscription.externalSubscriptionId?.trim()
    ) {
      return;
    }

    subscription.externalSubscriptionId = event.externalSubscriptionId;
    subscription.billingProvider = provider;
    subscription.paymentMethodId = subscription.paymentMethodId ?? event.externalSubscriptionId;

    if (event.planPriceId && event.planId) {
      const planPrice = await this.plansService.getPlanPriceById(event.planPriceId);
      if (planPrice?.isActive && planPrice.planId === event.planId) {
        subscription.planId = planPrice.planId;
        subscription.planPriceId = planPrice.id;
      }
    }

    if (event.quantity != null && Number.isFinite(event.quantity)) {
      subscription.currentUsers = resolveSeatCount(event.quantity);
    }

    const providerStatus = event.providerStatus?.toLowerCase();
    const hasPlanMetadata = !!event.planId && !!event.planPriceId;
    // Checkout with plan metadata = customer subscribed (card on file). Do not map
    // provider "trialing" to our free-app TRIAL — that made Scale look unpaid.
    if (hasPlanMetadata) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.trialEndsAt = null;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = null;
    } else if (providerStatus === 'trialing' || providerStatus === 'trial') {
      subscription.status = SubscriptionStatus.TRIAL;
      if (event.trialEndsAt) {
        const trialEnd = new Date(event.trialEndsAt);
        if (!Number.isNaN(trialEnd.getTime())) {
          subscription.trialEndsAt = trialEnd;
        }
      }
    } else if (providerStatus === 'active' || providerStatus === 'paid') {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.trialEndsAt = null;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = null;
    }

    if (event.currentPeriodStart) {
      const start = new Date(event.currentPeriodStart);
      if (!Number.isNaN(start.getTime())) {
        subscription.currentPeriodStart = start;
        // For a paid subscription that the provider reports as trialing,
        // the provider's period dates reflect the trial boundary (e.g.
        // 14 days), not the actual subscription period. Recalculate
        // currentPeriodEnd as start + 1 month so the active window is
        // monthly, not the trial length.
        if (hasPlanMetadata && providerStatus === 'trialing') {
          const correctEnd = new Date(start);
          correctEnd.setMonth(correctEnd.getMonth() + 1);
          subscription.currentPeriodEnd = correctEnd;
          subscription.nextBillingDate = correctEnd;
        }
      }
    }
    if (event.currentPeriodEnd && !(hasPlanMetadata && providerStatus === 'trialing')) {
      const end = new Date(event.currentPeriodEnd);
      if (!Number.isNaN(end.getTime())) subscription.currentPeriodEnd = end;
    }
    if (event.nextBillingDate && !(hasPlanMetadata && providerStatus === 'trialing')) {
      const next = new Date(event.nextBillingDate);
      if (!Number.isNaN(next.getTime())) subscription.nextBillingDate = next;
    } else if (!hasPlanMetadata && event.trialEndsAt) {
      const trialEnd = new Date(event.trialEndsAt);
      if (!Number.isNaN(trialEnd.getTime())) subscription.nextBillingDate = trialEnd;
    }

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_created',
      {
        tenantId: event.tenantId,
        externalSubscriptionId: event.externalSubscriptionId,
        planId: event.planId,
        planPriceId: event.planPriceId,
        providerStatus: event.providerStatus,
      },
      provider,
    );

    // Bachs catalog trial must not survive a paid Paqad checkout — end it so Bachs shows active.
    if (
      hasPlanMetadata &&
      (providerStatus === 'trialing' || providerStatus === 'trial') &&
      event.externalSubscriptionId
    ) {
      await this.endProviderTrialBestEffort(provider, event.externalSubscriptionId, event.tenantId);
    }
  }

  async processExternalSubscriptionCancelled(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.cancelled' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) {
      return;
    }

    let subscription: TenantSubscription | null = null;
    if (event.tenantId && UUID_PATTERN.test(event.tenantId)) {
      subscription = await this.subscriptionRepository.findOne({
        where: { tenantId: event.tenantId },
      });
    }
    if (!subscription && event.externalSubscriptionId?.trim()) {
      subscription = await this.subscriptionRepository.findOne({
        where: { externalSubscriptionId: event.externalSubscriptionId.trim() },
      });
    }
    if (!subscription || subscription.billingProvider !== provider) {
      return;
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancelAtPeriodEnd = false;
    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_cancelled',
      {
        tenantId: subscription.tenantId,
        externalSubscriptionId: event.externalSubscriptionId,
      },
      provider,
    );
  }

  async processBillingPayload(
    payload: unknown,
    provider: BillingProvider,
    paymentSuccessHandler: (payment: SubscriptionWebhookPayment, provider: BillingProvider) => Promise<void>,
    paymentFailedHandler: (payment: SubscriptionWebhookPayment, provider: BillingProvider) => Promise<void>,
  ): Promise<{ received: boolean }> {
    const billingProvider = this.billingProviderFactory.getProviderByEnum(provider);
    const event = billingProvider.parseWebhook(payload);
    if (!event || event.kind === 'ignored') {
      return { received: true };
    }

    let subscription = await this.resolveWebhookSubscription(event);
    if ((event.kind === 'payment.success' || event.kind === 'payment.failed') && subscription) {
      this.enrichPaymentFromSubscription(event.payment, subscription);
    }

    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID_PATTERN.test(tenantId) && !subscription) {
      subscription = await this.subscriptionRepository.findOne({ where: { tenantId } });
    }
    if (tenantId && UUID_PATTERN.test(tenantId)) {
      if (this.isStaleProviderWebhook(event, subscription, provider)) {
        this.logger.warn(
          `Ignoring ${event.kind} webhook from ${provider} for tenant ${tenantId}; active provider is ${subscription?.billingProvider}`,
        );
        return { received: true };
      }
    }

    if (event.kind === 'payment.success') {
      await paymentSuccessHandler(event.payment, provider);
    }

    if (event.kind === 'payment.failed') {
      await paymentFailedHandler(event.payment, provider);
    }

    if (event.kind === 'subscription.created') {
      await this.processExternalSubscriptionCreated(event, provider);
    }

    if (event.kind === 'subscription.cancelled') {
      await this.processExternalSubscriptionCancelled(event, provider);
    }

    return { received: true };
  }

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
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

    return { received: true, payload };
  }
}
