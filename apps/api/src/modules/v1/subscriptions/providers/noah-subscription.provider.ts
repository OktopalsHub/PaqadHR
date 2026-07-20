import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { NoahApiService } from 'src/common/services/noah-api.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingChargeType, CARD_UPDATE_VERIFY_AMOUNT } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { calculatePerSeatTotal, resolveSeatCount } from '../utils/per-seat-pricing.util';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

interface NoahWebhookPayload {
  event_type?: string;
  eventType?: string;
  type?: string;
  data?: {
    externalID?: string;
    externalId?: string;
    status?: string;
    fiatAmount?: string;
    amount?: number;
    fiatCurrency?: string;
    currency?: string;
    customerEmail?: string;
    paymentMethodID?: string;
    metadata?: Record<string, string>;
  };
}

@Injectable()
export class NoahSubscriptionProvider implements ISubscriptionBillingProvider {
  constructor(private readonly noahApi: NoahApiService) {}

  async createCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    planPrice: PlanPrice,
    successUrl: string,
    quantity = 1,
  ): Promise<SubscriptionCheckoutResponse> {
    const seats = resolveSeatCount(quantity);
    const amount = calculatePerSeatTotal(planPrice, seats);
    const currency = planPrice.currency.toUpperCase();
    const orderReference = `sub_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    const result = await this.noahApi.createPayinCheckout({
      orderReference,
      customerEmail: email,
      amount,
      currency,
      callbackUrl: successUrl,
      customerId: metadata.tenantId,
      tokenizeCard: true,
      meta: {
        ...metadata,
        quantity: seats,
        billingType: BillingChargeType.SUBSCRIPTION,
      },
    });

    return {
      id: result.orderReference,
      checkoutUrl: result.checkoutLink,
      reference: result.orderReference,
      authorizationUrl: result.checkoutLink,
    };
  }

  async createCardUpdateCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    successUrl: string,
    currency: string,
  ): Promise<SubscriptionCheckoutResponse> {
    const orderReference = `cu_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    const result = await this.noahApi.createPayinCheckout({
      orderReference,
      customerEmail: email,
      amount: CARD_UPDATE_VERIFY_AMOUNT,
      currency: currency.toUpperCase(),
      callbackUrl: successUrl,
      customerId: metadata.tenantId,
      tokenizeCard: true,
      meta: {
        ...metadata,
        billingType: BillingChargeType.CARD_UPDATE,
      },
    });

    return {
      id: result.orderReference,
      checkoutUrl: result.checkoutLink,
      reference: result.orderReference,
      authorizationUrl: result.checkoutLink,
    };
  }

  async getOrCreateCustomer(email: string, _displayName?: string): Promise<string> {
    return email.trim().toLowerCase();
  }

  async chargeRenewal(
    subscriptionReference: string,
    planPrice: PlanPrice,
    quantity: number,
    tokenKey: string,
    customerEmail: string,
    metadata: SubscriptionBillingMetadata,
  ): Promise<{ orderReference: string }> {
    const seats = resolveSeatCount(quantity);
    const amount = calculatePerSeatTotal(planPrice, seats);
    const currency = planPrice.currency.toUpperCase();
    const orderReference = `sub_ren_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    return this.noahApi.chargeSavedPaymentMethod({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      paymentMethodId: tokenKey,
      meta: {
        ...metadata,
        quantity: seats,
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
        previousReference: subscriptionReference,
      },
    });
  }

  async chargeSeatAddition(
    subscriptionReference: string,
    planPrice: PlanPrice,
    amount: number,
    targetSeatCount: number,
    extraSeats: number,
    tokenKey: string,
    customerEmail: string,
    metadata?: SubscriptionBillingMetadata,
  ): Promise<{ orderReference: string }> {
    const currency = planPrice.currency.toUpperCase();
    const tenantPart = (metadata?.tenantId ?? subscriptionReference).replace(/-/g, '').slice(0, 32);
    const orderReference = `sub_qty_${tenantPart}_${Date.now().toString(36)}`;

    return this.noahApi.chargeSavedPaymentMethod({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      paymentMethodId: tokenKey,
      meta: {
        ...metadata,
        billingType: BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE,
        previousReference: subscriptionReference,
        quantity: targetSeatCount,
        targetSeatCount,
        extraSeats,
        planId: metadata?.planId ?? planPrice.planId,
        planPriceId: metadata?.planPriceId ?? planPrice.id,
      },
    });
  }

  async getSubscription(subscriptionReference: string): Promise<unknown> {
    return this.noahApi.verifyTransaction(subscriptionReference);
  }

  verifyWebhookSignature(rawBody: string, signature: string, _timestamp?: string): boolean {
    return this.noahApi.verifyWebhookSignature(rawBody, signature);
  }

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null {
    const body = payload as NoahWebhookPayload;
    const eventType = (body.event_type || body.eventType || body.type || '').toLowerCase();
    const data = body.data;
    if (!data) return null;

    const meta = data.metadata ?? {};
    const reference = data.externalID ?? data.externalId;
    const tenantId = meta.tenantId;
    if (!reference || !tenantId) {
      return null;
    }

    const status = (data.status ?? '').toLowerCase();
    const isSuccess =
      eventType.includes('success') ||
      eventType.includes('completed') ||
      status === 'success' ||
      status === 'completed' ||
      status === 'paid';
    const isFailure = eventType.includes('fail') || status === 'failed' || status === 'rejected';

    if (!isSuccess && !isFailure) {
      return { kind: 'ignored', event: eventType || 'unknown' };
    }

    const payment = {
      eventId: reference,
      reference,
      tenantId: String(tenantId),
      planId: meta.planId ? String(meta.planId) : undefined,
      planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
      quantity: meta.quantity ? Number(meta.quantity) : undefined,
      extraSeats: meta.extraSeats ? Number(meta.extraSeats) : undefined,
      targetSeatCount: meta.targetSeatCount ? Number(meta.targetSeatCount) : undefined,
      amount: Number(data.amount ?? data.fiatAmount ?? 0),
      currency: (data.currency ?? data.fiatCurrency ?? 'USD').toUpperCase(),
      tokenKey: data.paymentMethodID,
      customerEmail: data.customerEmail,
      status: isSuccess ? 'success' : 'failed',
      billingType: meta.billingType ? String(meta.billingType) : undefined,
    };

    return isSuccess ? { kind: 'payment.success', payment } : { kind: 'payment.failed', payment };
  }

  mapStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case 'success':
      case 'active':
      case 'paid':
      case 'completed':
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
    if (!this.noahApi.isConfigured()) {
      throw new BadRequestException('Noah subscription billing is not configured');
    }
  }
}
