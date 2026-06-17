import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { BillingChargeType } from '../constants/billing.constants';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';
import {
  calculatePerSeatTotal,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { NombaApiService } from '../services/nomba-api.service';

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
  private readonly logger = new Logger(NombaSubscriptionProvider.name);

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
    const orderReference = `sub_${metadata.tenantId}_${Date.now()}`;

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
        nombaPlanId: planPrice.nombaPlanId ?? undefined,
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
    const orderReference = `sub_renew_${metadata.tenantId}_${Date.now()}`;

    this.logger.log(
      `Renewing Nomba subscription ${subscriptionReference} for ${seats} seats (${amount} ${currency})`,
    );

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
        nombaPlanId: planPrice.nombaPlanId ?? undefined,
      },
    });
  }

  async updateSubscription(
    subscriptionReference: string,
    planPrice: PlanPrice,
    quantity: number,
    tokenKey: string,
    customerEmail: string,
    metadata?: SubscriptionBillingMetadata,
  ): Promise<unknown> {
    const seats = resolveSeatCount(quantity);
    const amount = calculatePerSeatTotal(planPrice, seats);
    const currency = planPrice.currency.toUpperCase();
    const orderReference = `sub_qty_${subscriptionReference}_${Date.now()}`;

    this.logger.log(
      `Charging Nomba tokenized subscription ${subscriptionReference} for ${seats} seats (${amount} ${currency})`,
    );

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
        quantity: seats,
        planId: metadata?.planId ?? planPrice.planId,
        planPriceId: metadata?.planPriceId ?? planPrice.id,
        nombaPlanId: planPrice.nombaPlanId ?? undefined,
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
        billingType: orderMeta.billingType ?? data?.meta?.billingType,
      };
      const reference = order?.orderReference ?? data?.orderReference;
      if (!reference || !meta.tenantId) {
        return null;
      }

      return {
        kind: 'payment.success',
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
          tokenKey: data?.tokenizedCardData?.tokenKey,
          customerEmail: order?.customerEmail ?? data?.customerEmail,
          status: data?.status || 'success',
          billingType: meta.billingType ? String(meta.billingType) : undefined,
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
        billingType: orderMeta.billingType ?? data?.meta?.billingType,
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
          billingType: meta.billingType ? String(meta.billingType) : undefined,
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
}
