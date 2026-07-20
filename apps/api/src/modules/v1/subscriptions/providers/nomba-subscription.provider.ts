import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  BillingChargeType,
  CARD_UPDATE_VERIFY_AMOUNT,
  parseBillingChargeType,
} from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { NombaApiService } from '../services/nomba-api.service';
import { calculatePerSeatTotal, resolveSeatCount } from '../utils/per-seat-pricing.util';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

interface NombaWebhookPayload {
  event_type?: string;
  eventType?: string;
  data?: {
    orderReference?: string;
    amount?: number;
    currency?: string;
    customerEmail?: string;
    status?: string;
    tokenizedCardData?: {
      tokenKey?: string;
      cardType?: string;
      cardPan?: string;
    };
    meta?: SubscriptionBillingMetadata;
    order?: {
      orderReference?: string;
      customerEmail?: string;
      amount?: number;
      currency?: string;
      orderMetaData?: Record<string, string>;
    };
    transaction?: {
      transactionId?: string;
      merchantTxRef?: string;
      transactionAmount?: number;
      time?: string;
    };
  };
}

@Injectable()
export class NombaSubscriptionProvider implements ISubscriptionBillingProvider {
  constructor(private readonly nombaApi: NombaApiService) {}

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
    // Keep under Nomba's 50-char reference limit: raw UUID (36) + "sub_" +
    // timestamp overflows, so strip UUID hyphens and use a base36 timestamp.
    const orderReference = `sub_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    const result = await this.nombaApi.createCheckoutOrder({
      orderReference,
      customerEmail: email,
      amount,
      currency,
      callbackUrl: successUrl,
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
    // Keep under Nomba's 50-char reference limit (see createCheckout).
    const orderReference = `cu_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    const result = await this.nombaApi.createCheckoutOrder({
      orderReference,
      customerEmail: email,
      amount: CARD_UPDATE_VERIFY_AMOUNT,
      currency: currency.toUpperCase(),
      callbackUrl: successUrl,
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
    // Keep under Nomba's 50-char reference limit (see createCheckout).
    const orderReference = `sub_ren_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

    return this.nombaApi.chargeTokenizedCard({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      tokenKey,
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

    return this.nombaApi.chargeTokenizedCard({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      tokenKey,
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
    return this.nombaApi.verifyTransaction(subscriptionReference);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return this.nombaApi.verifyWebhookSignature(rawBody, signature);
  }

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null {
    const body = payload as NombaWebhookPayload;
    const eventType = (body.event_type || body.eventType || '').toLowerCase();

    if (eventType === 'payment_success') {
      const data = body.data;
      const order = data?.order;
      const orderMeta = order?.orderMetaData ?? {};
      const meta: SubscriptionBillingMetadata = {
        tenantId: orderMeta.tenantId ?? data?.meta?.tenantId,
        planId: orderMeta.planId ?? data?.meta?.planId,
        planPriceId: orderMeta.planPriceId ?? data?.meta?.planPriceId,
        userId: orderMeta.userId ?? data?.meta?.userId,
        tenantMemberId: orderMeta.tenantMemberId ?? data?.meta?.tenantMemberId,
        quantity: orderMeta.quantity ? Number(orderMeta.quantity) : data?.meta?.quantity,
        extraSeats: orderMeta.extraSeats ? Number(orderMeta.extraSeats) : data?.meta?.extraSeats,
        targetSeatCount: orderMeta.targetSeatCount
          ? Number(orderMeta.targetSeatCount)
          : data?.meta?.targetSeatCount,
        billingType: parseBillingChargeType(orderMeta.billingType ?? data?.meta?.billingType),
      };
      const reference = order?.orderReference ?? data?.orderReference;
      if (!reference || !meta.tenantId) {
        return null;
      }

      const card = this.parseTokenizedCard(data?.tokenizedCardData);
      const targetSeatCount = meta.targetSeatCount ?? meta.quantity;

      return {
        kind: 'payment.success',
        payment: {
          eventId: data?.transaction?.transactionId || reference,
          reference,
          tenantId: String(meta.tenantId),
          planId: meta.planId ? String(meta.planId) : undefined,
          planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
          quantity: targetSeatCount ? Number(targetSeatCount) : undefined,
          extraSeats: meta.extraSeats ? Number(meta.extraSeats) : undefined,
          targetSeatCount: targetSeatCount ? Number(targetSeatCount) : undefined,
          amount: Number(
            order?.amount ?? data?.amount ?? data?.transaction?.transactionAmount ?? 0,
          ),
          currency: (order?.currency ?? data?.currency ?? 'NGN').toUpperCase(),
          tokenKey: data?.tokenizedCardData?.tokenKey,
          customerEmail: order?.customerEmail ?? data?.customerEmail,
          status: data?.status || 'success',
          billingType: parseBillingChargeType(meta.billingType),
          ...card,
        },
      };
    }

    if (eventType === 'payment_failed' || eventType === 'payment.failure') {
      const data = body.data;
      const order = data?.order;
      const orderMeta = order?.orderMetaData ?? {};
      const meta: SubscriptionBillingMetadata = {
        tenantId: orderMeta.tenantId ?? data?.meta?.tenantId,
        planId: orderMeta.planId ?? data?.meta?.planId,
        planPriceId: orderMeta.planPriceId ?? data?.meta?.planPriceId,
        quantity: orderMeta.quantity ? Number(orderMeta.quantity) : data?.meta?.quantity,
        billingType: parseBillingChargeType(orderMeta.billingType ?? data?.meta?.billingType),
      };
      const reference = order?.orderReference ?? data?.orderReference;
      if (!reference || !meta.tenantId) {
        return null;
      }

      return {
        kind: 'payment.failed',
        payment: {
          eventId: data?.transaction?.transactionId || reference,
          reference,
          tenantId: String(meta.tenantId),
          planId: meta.planId ? String(meta.planId) : undefined,
          planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
          quantity: meta.quantity ? Number(meta.quantity) : undefined,
          amount: Number(
            order?.amount ?? data?.amount ?? data?.transaction?.transactionAmount ?? 0,
          ),
          currency: (order?.currency ?? data?.currency ?? 'NGN').toUpperCase(),
          customerEmail: order?.customerEmail ?? data?.customerEmail,
          status: data?.status || 'failed',
          billingType: parseBillingChargeType(meta.billingType),
        },
      };
    }

    return { kind: 'ignored', event: eventType || 'unknown' };
  }

  mapStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case 'success':
      case 'active':
      case 'paid':
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
    if (!this.nombaApi.isConfigured()) {
      throw new BadRequestException('Nomba subscription billing is not configured');
    }
  }

  private parseTokenizedCard(data?: { cardType?: string; cardPan?: string }): {
    cardBrand?: string;
    cardLastFour?: string;
  } {
    if (!data) return {};
    const digits = (data.cardPan ?? '').replace(/\D/g, '');
    return {
      cardBrand: data.cardType?.trim() || undefined,
      cardLastFour: digits.length >= 4 ? digits.slice(-4) : undefined,
    };
  }
}
