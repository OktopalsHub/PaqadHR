import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { getPolarAccessToken, getPolarWebhookSecret } from 'src/common/config/polar.config';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { getPolarProductId } from '../../plans/config/plan-external-products.config';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingChargeType } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';
import { calculatePerSeatTotal, resolveSeatCount } from '../utils/per-seat-pricing.util';
import type { ISubscriptionBillingProvider } from './subscription-billing-provider.interface';

type PolarWebhookPayload = {
  type?: string;
  data?: Record<string, unknown> & {
    id?: string;
    metadata?: Record<string, string>;
    amount?: number;
    currency?: string;
    status?: string;
    subscription_id?: string;
  };
};

@Injectable()
export class PolarSubscriptionProvider implements ISubscriptionBillingProvider {
  async createCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    planPrice: PlanPrice,
    successUrl: string,
    quantity = 1,
  ): Promise<SubscriptionCheckoutResponse> {
    const token = getPolarAccessToken();
    if (!token) {
      throw new BadRequestException('Polar is not configured');
    }

    const planSlug = planPrice.plan?.slug;
    if (!planSlug) {
      throw new BadRequestException('Plan slug missing for Polar checkout');
    }

    const polarProductId = getPolarProductId(planSlug);
    if (!polarProductId) {
      throw new BadRequestException(`Polar product not configured for plan "${planSlug}"`);
    }

    const seats = resolveSeatCount(quantity);
    const amountMinor = Math.round(calculatePerSeatTotal(planPrice, seats) * 100);

    const response = await fetch('https://api.polar.sh/v1/checkouts/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [polarProductId],
        customer_email: email,
        success_url: successUrl,
        metadata: {
          ...metadata,
          quantity: seats,
          billingType: BillingChargeType.SUBSCRIPTION,
          planSlug,
        },
        prices: {
          [polarProductId]: [
            {
              amount_type: 'fixed',
              price_amount: amountMinor,
              price_currency: planPrice.currency.toLowerCase(),
            },
          ],
        },
      }),
    });

    const payload = (await response.json()) as { url?: string; id?: string; detail?: string };
    if (!response.ok || !payload.url || !payload.id) {
      throw new BadRequestException(payload.detail ?? 'Polar checkout failed');
    }

    return {
      id: payload.id,
      checkoutUrl: payload.url,
      reference: payload.id,
      authorizationUrl: payload.url,
    };
  }

  async getOrCreateCustomer(email: string): Promise<string> {
    return email.trim().toLowerCase();
  }

  async chargeRenewal(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Polar renewals are handled by provider webhooks');
  }

  async chargeSeatAddition(): Promise<{ orderReference: string }> {
    throw new BadRequestException('Seat changes for Polar subscriptions are not supported yet');
  }

  async getSubscription(subscriptionReference: string): Promise<unknown> {
    const token = getPolarAccessToken();
    if (!token) throw new BadRequestException('Polar is not configured');

    const response = await fetch(
      `https://api.polar.sh/v1/checkouts/${encodeURIComponent(subscriptionReference)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.json();
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = getPolarWebhookSecret();
    if (!secret || !signature?.trim()) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  }

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null {
    const body = payload as PolarWebhookPayload;
    const eventType = (body.type || '').toLowerCase();
    const data = body.data ?? {};
    const metadata = (data.metadata ?? {}) as Record<string, string>;

    if (eventType.includes('subscription.created')) {
      const tenantId = metadata.tenantId;
      const externalSubscriptionId = String(data.subscription_id ?? data.id ?? '').trim();
      if (!tenantId || !externalSubscriptionId) return null;
      return {
        kind: 'subscription.created',
        tenantId,
        externalSubscriptionId,
        eventId: String(data.id ?? externalSubscriptionId),
      };
    }

    if (
      eventType.includes('subscription.canceled') ||
      eventType.includes('subscription.cancelled')
    ) {
      const tenantId = metadata.tenantId;
      if (!tenantId) return null;
      return {
        kind: 'subscription.cancelled',
        tenantId,
        externalSubscriptionId: data.subscription_id ? String(data.subscription_id) : undefined,
        eventId: String(data.id ?? `polar_cancel_${tenantId}`),
      };
    }

    if (eventType.includes('checkout.updated') || eventType.includes('order.created')) {
      const tenantId = metadata.tenantId;
      const reference = String(data.id ?? '').trim();
      if (!tenantId || !reference) return null;

      const status = String(data.status ?? '').toLowerCase();
      const payment = {
        eventId: reference,
        reference,
        tenantId,
        planId: metadata.planId,
        planPriceId: metadata.planPriceId,
        quantity: metadata.quantity ? Number(metadata.quantity) : undefined,
        amount: Number(data.amount ?? 0) / 100,
        currency: String(data.currency ?? 'USD').toUpperCase(),
        status: status.includes('succeed') ? 'success' : status,
        billingType: BillingChargeType.SUBSCRIPTION,
        externalSubscriptionId: data.subscription_id ? String(data.subscription_id) : undefined,
      };

      if (status.includes('succeed') || status === 'paid') {
        return { kind: 'payment.success', payment };
      }
      if (status.includes('fail')) {
        return { kind: 'payment.failed', payment };
      }
    }

    return { kind: 'ignored', event: eventType || 'unknown' };
  }

  mapStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
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
      default:
        return SubscriptionStatus.INACTIVE;
    }
  }

  ensureConfigured(): void {
    if (!getPolarAccessToken()) {
      throw new BadRequestException('Polar subscription billing is not configured');
    }
  }

  async cancelExternalSubscription(
    externalSubscriptionId: string,
    options?: { atPeriodEnd?: boolean },
  ): Promise<void> {
    const token = getPolarAccessToken();
    if (!token) {
      throw new BadRequestException('Polar is not configured');
    }

    const url = `https://api.polar.sh/v1/subscriptions/${encodeURIComponent(externalSubscriptionId)}`;
    const atPeriodEnd = options?.atPeriodEnd ?? false;

    const response = await fetch(url, {
      method: atPeriodEnd ? 'PATCH' : 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: atPeriodEnd ? JSON.stringify({ cancel_at_period_end: true }) : undefined,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { detail?: string };
      throw new BadRequestException(payload.detail ?? 'Polar subscription cancellation failed');
    }
  }
}
