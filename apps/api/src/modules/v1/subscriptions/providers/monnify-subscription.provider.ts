import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingChargeType, parseBillingChargeType } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { calculatePerSeatTotal, resolveSeatCount } from '../utils/per-seat-pricing.util';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

type MonnifyWebhookPayload = {
  eventType?: string;
  eventData?: Record<string, unknown> & {
    product?: { reference?: string; type?: string };
    transactionReference?: string;
    paymentReference?: string;
    amountPaid?: string | number;
    totalPayable?: string | number;
    paidOn?: string;
    paymentStatus?: string;
    currency?: string;
    customer?: { email?: string; name?: string };
    metaData?: Record<string, unknown> | string;
  };
};

@Injectable()
export class MonnifySubscriptionProvider implements ISubscriptionBillingProvider {
  constructor(private readonly monnifyApi: MonnifyApiService) {}

  ensureConfigured(): void {
    this.monnifyApi.ensureConfigured();
  }

  async createCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    planPrice: PlanPrice,
    successUrl: string,
    quantity = 1,
  ): Promise<SubscriptionCheckoutResponse> {
    const seats = resolveSeatCount(quantity);
    const amount = calculatePerSeatTotal(planPrice, seats);
    const orderReference = `sub_${metadata.tenantId.replace(/-/g, '')}_${Date.now().toString(36)}`;
    const planSlug = planPrice.plan?.slug ?? 'plan';

    const result = await this.monnifyApi.initializeTransaction({
      amount,
      customerEmail: email,
      customerName: email.split('@')[0] || 'Customer',
      paymentReference: orderReference,
      paymentDescription: `Paqad ${planSlug} subscription`,
      redirectUrl: successUrl,
      currencyCode: planPrice.currency.toUpperCase(),
      metaData: {
        ...metadata,
        quantity: seats,
        billingType: BillingChargeType.SUBSCRIPTION,
        planSlug,
      },
    });

    return {
      id: result.transactionReference,
      checkoutUrl: result.checkoutUrl,
      reference: result.paymentReference,
      authorizationUrl: result.checkoutUrl,
    };
  }

  async getOrCreateCustomer(email: string): Promise<string> {
    return email.trim().toLowerCase();
  }

  async chargeRenewal(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Monnify renewals require customer checkout');
  }

  async chargeSeatAddition(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Seat changes for Monnify subscriptions are not supported yet');
  }

  async getSubscription(subscriptionReference: string): Promise<unknown> {
    return this.monnifyApi.verifyTransaction(subscriptionReference);
  }

  verifyWebhookSignature(_rawBody: string, signature: string): boolean {
    return Boolean(signature?.trim());
  }

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null {
    const body = payload as MonnifyWebhookPayload;
    const eventType = String(body.eventType ?? '').toUpperCase();
    if (eventType !== 'SUCCESSFUL_TRANSACTION' && eventType !== 'OVERPAID_TRANSACTION') {
      return { kind: 'ignored', event: eventType || 'unknown' };
    }

    const data = body.eventData ?? {};
    const meta = this.extractMetadata(data.metaData);
    const billingType = parseBillingChargeType(String(meta.billingType ?? ''));
    if (billingType !== BillingChargeType.SUBSCRIPTION) {
      return { kind: 'ignored', event: eventType };
    }

    const tenantId = String(meta.tenantId ?? '');
    const reference = String(data.paymentReference ?? data.transactionReference ?? '');
    const amount = Number(data.amountPaid ?? data.totalPayable ?? 0);
    const currency = String(data.currency ?? 'NGN').toUpperCase();
    const status = String(data.paymentStatus ?? 'PAID').toUpperCase();

    if (!tenantId || !reference) {
      return null;
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        kind: 'payment.failed',
        payment: {
          eventId: reference,
          reference,
          tenantId,
          planId: meta.planId ? String(meta.planId) : undefined,
          planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
          quantity: meta.quantity ? Number(meta.quantity) : undefined,
          amount,
          currency,
          customerEmail: data.customer?.email,
          status,
          billingType: BillingChargeType.SUBSCRIPTION,
        },
      };
    }

    return {
      kind: 'payment.success',
      payment: {
        eventId: reference,
        reference,
        tenantId,
        planId: meta.planId ? String(meta.planId) : undefined,
        planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
        quantity: meta.quantity ? Number(meta.quantity) : undefined,
        amount,
        currency,
        customerEmail: data.customer?.email,
        status,
        billingType: BillingChargeType.SUBSCRIPTION,
      },
    };
  }

  mapStatus(status: string): SubscriptionStatus {
    const normalized = status.toLowerCase();
    if (normalized === 'paid' || normalized === 'successful' || normalized === 'success') {
      return SubscriptionStatus.ACTIVE;
    }
    if (normalized === 'trialing' || normalized === 'trial') {
      return SubscriptionStatus.TRIAL;
    }
    if (normalized === 'past_due' || normalized === 'failed') {
      return SubscriptionStatus.PAST_DUE;
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
      return SubscriptionStatus.CANCELLED;
    }
    return SubscriptionStatus.ACTIVE;
  }

  private extractMetadata(raw: unknown): Record<string, string> {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')]),
        );
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') {
      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ''),
        ]),
      );
    }
    return {};
  }
}
