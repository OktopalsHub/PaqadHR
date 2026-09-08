import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import type { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { BillingOverviewService } from './billing-overview.service';
import { type RenewalJobResult, RenewalProcessor } from './renewal-processor';
import { SeatPricingCalculator } from './seat-pricing-calculator';
import { SubscriptionCheckoutService } from './subscription-checkout.service';
import { SubscriptionsService } from './subscriptions.service';
import { WebhookDispatcher } from './webhook-dispatcher';

@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    private readonly webhookDispatcher: WebhookDispatcher,
    private readonly renewalProcessor: RenewalProcessor,
    private readonly seatPricing: SeatPricingCalculator,
    private readonly checkoutService: SubscriptionCheckoutService,
    private readonly overviewService: BillingOverviewService,
  ) {}

  async getBillingOverview(tenantId: string, canManageBilling: boolean, userId?: string | null) {
    return this.overviewService.getBillingOverview(tenantId, canManageBilling, userId);
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    return this.seatPricing.getTenantSeatCount(tenantId);
  }

  async createSubscriptionCheckout(
    tenantId: string,
    planSlug: string,
    userId: string,
    successUrl?: string,
    clientIp?: string | null,
    headers?: Record<string, string | string[] | undefined>,
  ) {
    return this.checkoutService.createSubscriptionCheckout(
      tenantId,
      planSlug,
      userId,
      successUrl,
      clientIp,
      headers,
    );
  }

  async createPaymentMethodUpdateCheckout(tenantId: string, userId: string, successUrl?: string) {
    return this.checkoutService.createPaymentMethodUpdateCheckout(tenantId, userId, successUrl);
  }

  async cancelSubscription(tenantId: string, dto: CancelSubscriptionDto = {}) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new Error('Already cancelled');
    }
    const atPeriodEnd = dto.atPeriodEnd !== false;
    const reason = dto.reason?.trim() || null;
    if (
      isManagedSubscriptionProvider(subscription.billingProvider) &&
      subscription.externalSubscriptionId
    ) {
      await this.billingProviderFactory.cancelExternalSubscription(
        subscription.billingProvider,
        subscription.externalSubscriptionId,
        atPeriodEnd,
      );
    }
    if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
      if (subscription.status === SubscriptionStatus.PAUSED)
        subscription.status = SubscriptionStatus.ACTIVE;
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancelAtPeriodEnd = false;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
    }
    return this.subscriptionRepo.save(subscription);
  }

  async resumeSubscription(tenantId: string) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (
      [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.INACTIVE,
      ].includes(subscription.status)
    ) {
      throw new Error('Cannot undo cancellation on this subscription');
    }
    if (!subscription.cancelAtPeriodEnd) throw new Error('No scheduled cancellation to undo');
    if (!subscription.paymentMethodId && !subscription.externalSubscriptionId)
      throw new Error('Add payment method first');
    if (new Date() >= subscription.currentPeriodEnd)
      throw new Error('Subscription period has ended');
    if (
      isManagedSubscriptionProvider(subscription.billingProvider) &&
      subscription.externalSubscriptionId
    ) {
      await this.billingProviderFactory.resumeExternalSubscription(
        subscription.billingProvider,
        subscription.externalSubscriptionId,
      );
    }
    if (subscription.status === SubscriptionStatus.PAUSED) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.pausedAt = null;
    }
    subscription.cancelAtPeriodEnd = false;
    subscription.cancellationReason = null;
    return this.subscriptionRepo.save(subscription);
  }

  async processDueRenewals(): Promise<RenewalJobResult> {
    return this.renewalProcessor.processDueRenewals();
  }
  async lapseStaleSubscriptions() {
    return this.renewalProcessor.lapseStaleSubscriptions();
  }
  async lapseStaleBachsSubscriptions() {
    return this.renewalProcessor.lapseStaleBachsSubscriptions();
  }
  async syncSubscriptionQuantity(tenantId: string) {
    return this.seatPricing.syncSubscriptionQuantity(tenantId);
  }

  async handleNombaWebhook(rawBody: string, signature: string) {
    return this.webhookDispatcher.handleNombaWebhook(rawBody, signature);
  }
  processNombaPayload(payload: unknown) {
    return this.webhookDispatcher.processNombaPayload(payload);
  }
  processBachsPayload(payload: unknown) {
    return this.webhookDispatcher.processBachsPayload(payload);
  }
  processPolarPayload(payload: unknown) {
    return this.webhookDispatcher.processPolarPayload(payload);
  }
  processMonnifyPayload(payload: unknown) {
    return this.webhookDispatcher.processMonnifyPayload(payload);
  }
}
