import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingChargeType, CARD_UPDATE_VERIFY_AMOUNT } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { NombaApiService } from '../services/nomba-api.service';
import { calculatePerSeatTotal, resolveSeatCount } from '../utils/per-seat-pricing.util';
import { parseNombaWebhook } from './nomba-webhook-parsers';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

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
    // Prefer caller-supplied period-scoped reference (≤50 chars) so retries dedupe at Nomba.
    const fromMeta =
      typeof metadata.orderReference === 'string' ? metadata.orderReference.trim() : '';
    const orderReference =
      fromMeta || `sub_ren_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;

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
        orderReference,
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
    return parseNombaWebhook(payload);
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
