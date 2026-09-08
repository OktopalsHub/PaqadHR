import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionWebhookEvent } from '../interfaces/subscription-billing.interface';
import { isValidUuid } from '../utils/billing-utils';

@Injectable()
export class WebhookEventResolver {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
  ) {}

  resolveWebhookTenantId(event: SubscriptionWebhookEvent): string | null {
    if (event.kind === 'subscription.created' || event.kind === 'subscription.cancelled')
      return event.tenantId;
    if (event.kind === 'payment.success' || event.kind === 'payment.failed')
      return event.payment.tenantId;
    return null;
  }

  isTrialInitialCheckoutWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription,
  ): boolean {
    return (
      subscription.status === SubscriptionStatus.TRIAL &&
      event.kind === 'payment.success' &&
      event.payment.billingType === BillingChargeType.SUBSCRIPTION
    );
  }

  isStaleProviderWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription | null,
    webhookProvider: BillingProvider,
  ): boolean {
    if (!subscription?.billingProvider || subscription.billingProvider === webhookProvider)
      return false;
    if (this.isTrialInitialCheckoutWebhook(event, subscription)) return false;
    return true;
  }

  async resolveWebhookSubscription(
    event: SubscriptionWebhookEvent,
  ): Promise<TenantSubscription | null> {
    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && isValidUuid(tenantId))
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

  enrichPaymentFromSubscription(
    payment: {
      tenantId?: string;
      planId?: string;
      planPriceId?: string;
      quantity?: number;
      externalSubscriptionId?: string;
    },
    subscription: TenantSubscription,
  ): void {
    if (!payment.tenantId?.trim() || !isValidUuid(payment.tenantId))
      payment.tenantId = subscription.tenantId;
    if (!payment.planId?.trim()) payment.planId = subscription.planId;
    if (!payment.planPriceId?.trim()) payment.planPriceId = subscription.planPriceId;
    if (payment.quantity == null && subscription.currentUsers != null)
      payment.quantity = subscription.currentUsers;
    if (!payment.externalSubscriptionId?.trim() && subscription.externalSubscriptionId)
      payment.externalSubscriptionId = subscription.externalSubscriptionId;
  }
}
