import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { PlansService } from '../../plans/services/plans.service';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookEvent } from '../interfaces/subscription-billing.interface';
import { isValidUuid } from '../utils/billing-utils';
import { BillingEventStore } from './billing-event-store';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { PaymentSuccessHandlers } from './payment-success-handlers';
import { RenewalProcessor } from './renewal-processor';
import { WebhookEventResolver } from './webhook-event-resolver';

@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly renewalProcessor: RenewalProcessor,
    private readonly productAnalytics: ProductAnalyticsService,
    private readonly eventResolver: WebhookEventResolver,
    private readonly billingEventStore: BillingEventStore,
    private readonly paymentHandlers: PaymentSuccessHandlers,
  ) {}

  async processBillingPayload(
    payload: unknown,
    provider: BillingProvider,
  ): Promise<{ received: boolean }> {
    const billingProvider = this.billingProviderFactory.getProviderByEnum(provider);
    const event = billingProvider.parseWebhook(payload);
    if (!event || event.kind === 'ignored') return { received: true };

    let subscription = await this.eventResolver.resolveWebhookSubscription(event);
    if ((event.kind === 'payment.success' || event.kind === 'payment.failed') && subscription) {
      this.eventResolver.enrichPaymentFromSubscription(event.payment, subscription);
    }

    const tenantId = this.eventResolver.resolveWebhookTenantId(event);
    if (tenantId && isValidUuid(tenantId) && !subscription) {
      subscription = await this.subscriptionRepo.findOne({ where: { tenantId } });
    }
    if (
      tenantId &&
      isValidUuid(tenantId) &&
      this.eventResolver.isStaleProviderWebhook(event, subscription, provider)
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
        await this.paymentHandlers.processRenewalPaymentSuccess(event.payment, provider);
      else if (billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE)
        await this.paymentHandlers.processQuantityUpdatePaymentSuccess(event.payment, provider);
      else if (billingType === BillingChargeType.CARD_UPDATE)
        await this.paymentHandlers.processCardUpdateSuccess(event.payment, provider);
      else await this.paymentHandlers.processInitialPaymentSuccess(event.payment, provider);
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

  private async processPaymentFailed(
    payment: { eventId: string; tenantId: string; billingType?: string; reference?: string },
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !isValidUuid(payment.tenantId) ||
      (await this.billingEventStore.hasProcessedEvent(payment.eventId, provider))
    )
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
      await this.billingEventStore.recordBillingEvent(
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
        payment.reference ?? '',
        'renewal_payment_failed',
      );
      await this.billingEventStore.recordBillingEvent(
        payment.eventId,
        'renewal_failed_webhook',
        payment as unknown as Record<string, unknown>,
        provider,
      );
      return;
    }
    await this.billingEventStore.recordBillingEvent(
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
    if (await this.billingEventStore.hasProcessedEvent(event.eventId, provider)) return;
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
    if (event.quantity != null) sub.currentUsers = event.quantity;
    const hasPlan = !!event.planId && !!event.planPriceId;
    if (hasPlan) {
      sub.status = SubscriptionStatus.ACTIVE;
      sub.trialEndsAt = null;
      sub.cancelAtPeriodEnd = false;
      sub.cancelledAt = null;
    }
    await this.subscriptionRepo.save(sub);
    await this.billingEventStore.recordBillingEvent(
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
    if (await this.billingEventStore.hasProcessedEvent(event.eventId, provider)) return;
    let sub =
      event.tenantId && isValidUuid(event.tenantId)
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
    await this.billingEventStore.recordBillingEvent(
      event.eventId,
      'subscription_cancelled',
      { tenantId: sub.tenantId, externalSubscriptionId: event.externalSubscriptionId },
      provider,
    );
  }
}
