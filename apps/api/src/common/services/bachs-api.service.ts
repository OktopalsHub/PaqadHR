import { Injectable, Logger } from '@nestjs/common';
import { getBachsBaseUrl, getBachsSecretKey } from 'src/common/config/bachs.config';

export interface BachsProductInput {
  name: string;
  description?: string;
  currency: string;
  amount: string;
  billingCycle?: { interval: 'month'; frequency: number };
  metadata?: Record<string, string>;
}

export interface BachsCheckoutInput {
  productId: string;
  quantity: number;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  cancelUrl?: string;
  billingCurrency?: string;
  reference: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

@Injectable()
export class BachsApiService {
  private readonly logger = new Logger(BachsApiService.name);

  isConfigured(): boolean {
    return Boolean(getBachsSecretKey());
  }

  async listProducts(includeArchived = false): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({ limit: '100' });
    if (includeArchived) params.set('include_archived', 'true');
    const payload = await this.request<{ items?: Array<Record<string, unknown>> }>(
      `/v1/products?${params.toString()}`,
    );
    return payload.items ?? [];
  }

  async createProduct(input: BachsProductInput): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      price: {
        price_type: 'fixed',
        currency: input.currency,
        amount: input.amount,
      },
      metadata: input.metadata ?? {},
    };
    if (input.billingCycle) {
      body.billing_cycle = input.billingCycle;
    }
    return this.request<{ id: string }>('/v1/products', { method: 'POST', body });
  }

  async createCheckoutSession(input: BachsCheckoutInput): Promise<{
    checkout_id: string;
    checkout_url: string;
    reference?: string;
  }> {
    const metadata = Object.fromEntries(
      Object.entries(input.metadata ?? {}).filter(([, value]) => value != null),
    );

    return this.request('/v1/checkout-sessions', {
      method: 'POST',
      body: {
        customer: {
          email: input.customerEmail,
          name: input.customerName,
        },
        product_cart: [
          {
            product_id: input.productId,
            quantity: input.quantity,
          },
        ],
        billing_currency: input.billingCurrency,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference: input.reference,
        metadata,
      },
    });
  }

  async getCheckoutSession(checkoutId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);
  }

  async getPayment(paymentId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  async getSubscription(subscriptionId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd = false,
  ): Promise<Record<string, unknown>> {
    return this.request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      body: { cancel_at_period_end: cancelAtPeriodEnd },
    });
  }

  /**
   * Best-effort undo of a scheduled period-end cancel.
   * Bachs docs emphasize cancel; if the API rejects this PATCH, callers surface the error.
   */
  async resumeSubscription(subscriptionId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PATCH',
      body: { cancel_at_period_end: false },
    });
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown },
  ): Promise<T> {
    const secretKey = getBachsSecretKey();
    if (!secretKey) {
      throw new Error('bachs_not_configured');
    }

    const response = await fetch(`${getBachsBaseUrl()}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as T & {
      detail?: string;
      error_code?: string;
    };

    if (!response.ok) {
      const detail = payload.detail ?? response.statusText;
      this.logger.warn(`Bachs API ${options?.method ?? 'GET'} ${path} failed: ${detail}`);
      throw new Error(detail || 'bachs_api_error');
    }

    return payload;
  }
}
