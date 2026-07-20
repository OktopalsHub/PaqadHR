import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { BachsApiService } from 'src/common/services/bachs-api.service';
import { resolveBachsProductId } from '../../plans/config/plan-external-products.config';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingChargeType, parseBillingChargeType } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { resolveSeatCount } from '../utils/per-seat-pricing.util';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

type BachsWebhookPayload = {
  id?: string;
  type?: string;
  data?: Record<string, unknown> & {
    reference?: string;
    charge_id?: string;
    checkout_id?: string;
    subscription_id?: string;
    status?: string;
    fiat_amount?: string;
    amount?: string | number;
    fiat_currency?: string;
    currency?: string;
    metadata?: Record<string, string>;
  };
};

@Injectable()
export class BachsSubscriptionProvider implements ISubscriptionBillingProvider {
  constructor(private readonly bachsApi: BachsApiService) {}

  async createCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    planPrice: PlanPrice,
    successUrl: string,
    quantity = 1,
  ): Promise<SubscriptionCheckoutResponse> {
    const planSlug = planPrice.plan?.slug;
    if (!planSlug) {
      throw new BadRequestException('Plan slug missing for Bachs checkout');
    }

    const productId = resolveBachsProductId(planPrice);
    if (!productId) {
      throw new BadRequestException(
        `Bachs product not configured for plan "${planSlug}" (${planPrice.currency}). Run: pnpm --filter api sync:bachs-products`,
      );
    }

    const seats = resolveSeatCount(quantity);
    const orderReference = `sub_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;
    const cancelUrl = successUrl.includes('billing=success')
      ? successUrl.replace('billing=success', 'billing=cancelled')
      : undefined;

    const result = await this.bachsApi.createCheckoutSession({
      productId,
      quantity: seats,
      customerEmail: email,
      customerName: email.split('@')[0] || 'Customer',
      successUrl,
      cancelUrl,
      billingCurrency: planPrice.currency.toUpperCase(),
      reference: orderReference,
      metadata: {
        ...metadata,
        quantity: seats,
        billingType: BillingChargeType.SUBSCRIPTION,
        planSlug,
      },
    });

    return {
      id: result.checkout_id,
      checkoutUrl: result.checkout_url,
      reference: result.reference ?? orderReference,
      authorizationUrl: result.checkout_url,
    };
  }

  async getOrCreateCustomer(email: string): Promise<string> {
    return email.trim().toLowerCase();
  }

  async chargeRenewal(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Bachs renewals are handled by provider webhooks');
  }

  async chargeSeatAddition(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Seat changes for Bachs subscriptions are not supported yet');
  }

  async getSubscription(subscriptionReference: string): Promise<unknown> {
    return this.bachsApi.getSubscription(subscriptionReference);
  }

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null {
    const body = payload as BachsWebhookPayload;
    const eventType = (body.type || '').toLowerCase();
    const data = body.data ?? {};
    const metadata = this.extractMetadata(data);

    if (eventType === 'customer.subscription.created') {
      const tenantId = metadata.tenantId;
      const externalSubscriptionId = String(data.subscription_id ?? data.id ?? '').trim();
      if (!tenantId || !externalSubscriptionId) {
        return null;
      }
      return {
        kind: 'subscription.created',
        tenantId,
        externalSubscriptionId,
        eventId: body.id ?? externalSubscriptionId,
      };
    }

    if (eventType === 'customer.subscription.deleted') {
      const tenantId = metadata.tenantId;
      if (!tenantId) return null;
      return {
        kind: 'subscription.cancelled',
        tenantId,
        externalSubscriptionId: data.subscription_id ? String(data.subscription_id) : undefined,
        eventId: body.id ?? `sub_deleted_${tenantId}`,
      };
    }

    if (eventType === 'collection.succeeded' || eventType === 'invoice.paid') {
      return this.parsePaymentEvent(body, 'success', metadata, eventType);
    }

    if (eventType === 'collection.failed' || eventType === 'invoice.payment_failed') {
      return this.parsePaymentEvent(body, 'failed', metadata, eventType);
    }

    return { kind: 'ignored', event: eventType || 'unknown' };
  }

  mapStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case 'success':
      case 'active':
      case 'paid':
      case 'succeeded':
        return SubscriptionStatus.ACTIVE;
      case 'cancelled':
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
      case 'failed':
        return SubscriptionStatus.PAST_DUE;
      case 'expired':
        return SubscriptionStatus.EXPIRED;
      default:
        return SubscriptionStatus.INACTIVE;
    }
  }

  ensureConfigured(): void {
    if (!this.bachsApi.isConfigured()) {
      throw new BadRequestException('Bachs subscription billing is not configured');
    }
  }

  async cancelExternalSubscription(
    externalSubscriptionId: string,
    options?: { atPeriodEnd?: boolean },
  ): Promise<void> {
    await this.bachsApi.cancelSubscription(externalSubscriptionId, options?.atPeriodEnd ?? false);
  }

  private parsePaymentEvent(
    body: BachsWebhookPayload,
    outcome: 'success' | 'failed',
    metadata: SubscriptionBillingMetadata,
    eventType: string,
  ): SubscriptionWebhookEvent | null {
    const data = body.data ?? {};
    const tenantId = metadata.tenantId;
    const reference = String(
      data.reference ?? data.charge_id ?? data.checkout_id ?? body.id ?? '',
    ).trim();
    if (!tenantId || !reference) {
      return null;
    }

    const amountRaw = data.fiat_amount ?? data.amount ?? metadata.amount ?? 0;
    const currency = String(
      data.fiat_currency ?? data.currency ?? metadata.currency ?? 'USD',
    ).toUpperCase();

    const billingType =
      eventType === 'invoice.paid' || eventType === 'invoice.payment_failed'
        ? BillingChargeType.SUBSCRIPTION_RENEWAL
        : (parseBillingChargeType(metadata.billingType) ?? BillingChargeType.SUBSCRIPTION);

    const payment = {
      eventId: body.id ?? reference,
      reference,
      tenantId: String(tenantId),
      planId: metadata.planId ? String(metadata.planId) : undefined,
      planPriceId: metadata.planPriceId ? String(metadata.planPriceId) : undefined,
      quantity: metadata.quantity ? Number(metadata.quantity) : undefined,
      amount: Number(amountRaw),
      currency,
      customerEmail: metadata.customerEmail ? String(metadata.customerEmail) : undefined,
      status: outcome,
      billingType,
      externalSubscriptionId: data.subscription_id ? String(data.subscription_id) : undefined,
    };

    return outcome === 'success'
      ? { kind: 'payment.success', payment }
      : { kind: 'payment.failed', payment };
  }

  private extractMetadata(data: Record<string, unknown>): SubscriptionBillingMetadata {
    const meta = (data.metadata ?? {}) as Record<string, string | number | undefined>;
    return {
      tenantId: String(meta.tenantId ?? ''),
      planId: meta.planId ? String(meta.planId) : undefined,
      planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
      userId: meta.userId ? String(meta.userId) : undefined,
      tenantMemberId: meta.tenantMemberId ? String(meta.tenantMemberId) : undefined,
      quantity: meta.quantity != null ? Number(meta.quantity) : undefined,
      billingType: parseBillingChargeType(meta.billingType),
      amount: meta.amount != null ? Number(meta.amount) : undefined,
      currency: meta.currency ? String(meta.currency) : undefined,
      customerEmail: meta.customerEmail ? String(meta.customerEmail) : undefined,
    };
  }
}
