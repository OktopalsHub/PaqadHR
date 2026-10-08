import { Injectable, Logger } from '@nestjs/common';
import {
  type BachsWalletTopupCurrency,
  getBachsBaseUrl,
  getBachsSecretKey,
  getBachsWalletTopupProductId,
} from 'src/common/config/bachs.config';
import { scopeBachsCustomerEmail } from 'src/common/config/bachs-customer.util';

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
  /** When set, attaches the checkout to an existing Bachs customer (`cust_…`). */
  customerId?: string;
  savePaymentMethod?: boolean;
  reference: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface BachsWalletTopupCheckoutInput {
  amount: number;
  currency: BachsWalletTopupCurrency;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  cancelUrl?: string;
  /** When set, attaches the checkout to an existing Bachs customer (`cust_…`). */
  customerId?: string;
  savePaymentMethod?: boolean;
  /**
   * Pin checkout `billing_currency` to the wallet/float currency.
   * Defaults to true — adaptive local-currency chooser is unsafe for fixed wallet credits.
   */
  pinBillingCurrency?: boolean;
  reference: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

/** Bachs API errors carry a machine-readable error_code alongside the human detail. */
export class BachsApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'BachsApiError';
  }
}

export interface BachsBankAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BachsPayoutDestinationInput {
  /** Destination currency: NGN/USD/EUR/GBP bank, or USDT_TRC20/USDT_BEP20 wallets. */
  currency: string;
  type?: 'bank_account' | 'mobile_money' | 'crypto_wallet';
  name?: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  bankName?: string;
  sortCode?: string;
  iban?: string;
  swiftBic?: string;
  routingNumber?: string;
  scheme?: 'ach' | 'wire' | 'rtp';
  bankAddress?: BachsBankAddress;
  walletAddress?: string;
  network?: string;
}

export interface BachsPayoutDestination {
  id: string;
  status?: 'pending_review' | 'approved' | 'rejected';
  is_usable?: boolean;
  account_name?: string | null;
  bank_name?: string | null;
}

export interface BachsPayoutQuote {
  quote_id: string;
  from_amount?: string;
  to_amount?: string;
  exchange_rate?: string;
}

export interface BachsCreatePayoutInput {
  destination: string;
  /** Decimal string in the destination currency. Required unless quoteId is set. */
  amount?: string;
  /** From Create Payout Quote — required instead of amount for cross-currency payouts. */
  quoteId?: string;
  /** Paqad payroll merchant ref; returned verbatim on payout webhooks. */
  reference: string;
  /** Sent as the Idempotency-Key header — a retry without it can pay twice. */
  idempotencyKey: string;
}

export interface BachsPayoutResult {
  id: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  /** Net amount delivered, in the destination currency. */
  amount?: string;
  currency?: string;
  source_currency?: string | null;
  total_debited?: string | null;
  reference?: string | null;
  failure_reason?: string | null;
}

@Injectable()
export class BachsApiService {
  private readonly logger = new Logger(BachsApiService.name);
  private adaptivePricingEnsured = false;

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
    await this.ensureAdaptivePricingEnabled();
    const metadata = Object.fromEntries(
      Object.entries(input.metadata ?? {}).filter(([, value]) => value != null),
    );

    return this.request('/v1/checkout-sessions', {
      method: 'POST',
      body: {
        customer: input.customerId
          ? { customer_id: input.customerId }
          : {
              email: input.customerEmail,
              name: input.customerName,
            },
        product_cart: [
          {
            product_id: input.productId,
            quantity: input.quantity,
          },
        ],
        ...(input.billingCurrency ? { billing_currency: input.billingCurrency } : {}),
        ...(input.savePaymentMethod ? { save_payment_method: true } : {}),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference: input.reference,
        metadata,
      },
    });
  }

  async createWalletTopupCheckout(input: BachsWalletTopupCheckoutInput): Promise<{
    checkout_id: string;
    checkout_url: string;
    reference?: string;
  }> {
    const productId = getBachsWalletTopupProductId(input.currency);
    if (!productId) {
      throw new Error('bachs_wallet_topup_product_not_configured');
    }

    await this.ensureAdaptivePricingEnabled();
    const metadata = Object.fromEntries(
      Object.entries(input.metadata ?? {}).filter(([, value]) => value != null),
    );
    // Always pin wallet/float currency so adaptive FX cannot change what we credit.
    const pinBilling = input.pinBillingCurrency !== false;

    return this.request('/v1/checkout-sessions', {
      method: 'POST',
      body: {
        customer: input.customerId
          ? { customer_id: input.customerId }
          : {
              email: input.customerEmail,
              name: input.customerName,
            },
        product_cart: [
          {
            product_id: productId,
            quantity: 1,
            pricing: {
              price_type: 'fixed',
              amount: input.amount.toFixed(2),
              currency: input.currency,
            },
          },
        ],
        ...(pinBilling ? { billing_currency: input.currency } : {}),
        ...(input.savePaymentMethod !== false ? { save_payment_method: true } : {}),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference: input.reference,
        metadata,
      },
    });
  }

  /**
   * Find or create a Bachs customer scoped to one Paqad tenant.
   * Never reuse a bare billing email across tenants (shared MSP contacts).
   */
  async findOrCreateCustomer(input: {
    email: string;
    name: string;
    tenantId: string;
  }): Promise<{ customer_id: string }> {
    const email = scopeBachsCustomerEmail(input.email, input.tenantId);
    try {
      const listed = await this.request<{
        items?: Array<{ customer_id?: string; id?: string; email?: string }>;
      }>(`/v1/customers?limit=5&search=${encodeURIComponent(email)}`);
      const match = (listed.items ?? []).find(
        (item) => (item.email ?? '').trim().toLowerCase() === email,
      );
      const existingId = match?.customer_id ?? match?.id;
      if (existingId?.startsWith('cust_')) {
        return { customer_id: existingId };
      }
    } catch {
      // Fall through to create.
    }

    const created = await this.request<{ customer_id?: string; id?: string }>('/v1/customers', {
      method: 'POST',
      body: {
        email,
        name: input.name.trim() || email,
        metadata: { tenantId: input.tenantId },
      },
    });
    const customerId = created.customer_id ?? created.id;
    if (!customerId?.startsWith('cust_')) {
      throw new Error('bachs_customer_create_failed');
    }
    return { customer_id: customerId };
  }

  /**
   * Off-session charge of a saved card. Status may be `processing` — wait for
   * `collection.succeeded` / verify before crediting.
   */
  async createCharge(input: {
    customerId: string;
    amount: number;
    currency: string;
    reference: string;
    description?: string;
    paymentMethodId?: string;
    metadata?: Record<string, string | number | boolean | undefined>;
    idempotencyKey: string;
  }): Promise<{ payment_id: string; status: string; amount?: string }> {
    const metadata = Object.fromEntries(
      Object.entries(input.metadata ?? {}).filter(([, value]) => value != null),
    );
    return this.request('/v1/charges', {
      method: 'POST',
      body: {
        customer: input.customerId,
        amount: input.amount.toFixed(2),
        currency: input.currency.toUpperCase(),
        reference: input.reference,
        ...(input.description ? { description: input.description } : {}),
        ...(input.paymentMethodId ? { payment_method: input.paymentMethodId } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
      idempotencyKey: input.idempotencyKey,
    });
  }

  /**
   * Org-level adaptive pricing lets USD checkouts show a local-currency chooser.
   * NGN-priced checkouts stay NGN regardless — Bachs does not convert those at the page.
   */
  async ensureAdaptivePricingEnabled(): Promise<void> {
    if (this.adaptivePricingEnsured) return;
    try {
      const settings = await this.request<{ adaptive_pricing?: boolean }>(
        '/v1/accounts/checkout/settings',
      );
      if (settings.adaptive_pricing === true) {
        this.adaptivePricingEnsured = true;
        return;
      }
      await this.request('/v1/accounts/checkout/settings', {
        method: 'PUT',
        body: { adaptive_pricing: true },
      });
      this.adaptivePricingEnsured = true;
    } catch (error) {
      this.logger.warn(
        `Could not enable Bachs adaptive_pricing: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Paginated lookup by checkout reference for wallet top-up verification. */
  async findPaymentByReference(
    reference: string,
  ): Promise<{ status: string; amount: number } | null> {
    const encoded = encodeURIComponent(reference);
    // Prefer filtered lookup when supported; fall back to paging.
    try {
      const filtered = await this.request<{
        items?: Array<{
          reference?: string | null;
          status?: string;
          amount_paid?: string | null;
          amount?: string | null;
        }>;
      }>(`/v1/payments?limit=20&reference=${encoded}`);
      const match = (filtered.items ?? []).find((item) => item.reference === reference);
      if (match) {
        return this.mapPaymentSummary(match);
      }
    } catch {
      // Older API builds may not accept reference filter — continue with scan.
    }

    let offset = 0;
    for (;;) {
      const payload = await this.request<{
        items?: Array<{
          reference?: string | null;
          status?: string;
          amount_paid?: string | null;
          amount?: string | null;
        }>;
        pagination?: { has_more?: boolean };
      }>(`/v1/payments?limit=100&offset=${offset}`);

      const items = payload.items ?? [];
      const match = items.find((item) => item.reference === reference);
      if (match) {
        return this.mapPaymentSummary(match);
      }

      if (!payload.pagination?.has_more || items.length === 0) {
        return null;
      }
      offset += items.length;
    }
  }

  private mapPaymentSummary(match: {
    status?: string;
    amount_paid?: string | null;
    amount?: string | null;
  }): { status: string; amount: number } {
    const status = String(match.status ?? '').toLowerCase();
    const amount = Number(match.amount_paid ?? match.amount ?? 0);
    return {
      status,
      amount: Number.isFinite(amount) ? amount : 0,
    };
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

  /**
   * End a Bachs trial immediately (past/now trial_end → active + first charge).
   * Paqad free trial is in-app only; Bachs catalog products must not leave customers trialing after checkout.
   */
  async endSubscriptionTrial(subscriptionId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PATCH',
      body: { trial_end: new Date().toISOString() },
    });
  }

  /** Register a payout destination. Bachs resolves/reviews the account in this call. */
  async createPayoutDestination(
    input: BachsPayoutDestinationInput,
  ): Promise<BachsPayoutDestination> {
    const body: Record<string, unknown> = { currency: input.currency };
    if (input.type) body.type = input.type;
    if (input.name) body.name = input.name;
    if (input.accountNumber) body.account_number = input.accountNumber;
    if (input.bankCode) body.bank_code = input.bankCode;
    if (input.accountName) body.account_name = input.accountName;
    if (input.bankName) body.bank_name = input.bankName;
    if (input.sortCode) body.sort_code = input.sortCode;
    if (input.iban) body.iban = input.iban;
    if (input.swiftBic) body.swift_bic = input.swiftBic;
    if (input.routingNumber) body.routing_number = input.routingNumber;
    if (input.scheme) body.scheme = input.scheme;
    if (input.bankAddress) {
      body.bank_address = {
        line1: input.bankAddress.line1,
        city: input.bankAddress.city,
        state: input.bankAddress.state,
        postal_code: input.bankAddress.postalCode,
        country: input.bankAddress.country,
      };
    }
    if (input.walletAddress) body.wallet_address = input.walletAddress;
    if (input.network) body.network = input.network;
    return this.request<BachsPayoutDestination>('/v1/payouts/destinations', {
      method: 'POST',
      body,
    });
  }

  /**
   * Quote a cross-currency payout. `amount` is in `fromCurrency` (the balance being
   * debited). Same-currency payouts must NOT be quoted — Bachs rejects that.
   * International bank routes need `payoutMethod: 'BANK_TRANSFER'`.
   */
  async createPayoutQuote(input: {
    fromCurrency: string;
    toCurrency: string;
    amount: string;
    payoutMethod?: 'BANK_TRANSFER';
  }): Promise<BachsPayoutQuote> {
    const body: Record<string, unknown> = {
      from_currency: input.fromCurrency,
      to_currency: input.toCurrency,
      amount: input.amount,
    };
    if (input.payoutMethod) body.payout_method = input.payoutMethod;
    return this.request<BachsPayoutQuote>('/v1/payouts/quotes', {
      method: 'POST',
      body,
    });
  }

  /**
   * Create a payout. Always sends the Idempotency-Key header — Bachs double-pays on
   * a retry without one, and a 5xx response is not proof the payout was not created.
   */
  async createPayout(input: BachsCreatePayoutInput): Promise<BachsPayoutResult> {
    const body: Record<string, unknown> = {
      destination: input.destination,
      reference: input.reference,
    };
    if (input.quoteId) {
      body.quote_id = input.quoteId;
    } else {
      body.amount = input.amount;
    }
    return this.request<BachsPayoutResult>('/v1/payouts', {
      method: 'POST',
      body,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Get a payout by id (`pay_...`). Returns null when the payout does not exist. */
  async getPayout(payoutId: string): Promise<BachsPayoutResult | null> {
    try {
      return await this.request<BachsPayoutResult>(`/v1/payouts/${encodeURIComponent(payoutId)}`);
    } catch (error) {
      if (error instanceof BachsApiError && error.httpStatus === 404) {
        return null;
      }
      throw error;
    }
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const secretKey = getBachsSecretKey();
    if (!secretKey) {
      throw new Error('bachs_not_configured');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const response = await fetch(`${getBachsBaseUrl()}${path}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as T & {
      detail?: string;
      error_code?: string;
    };

    if (!response.ok) {
      const detail = payload.detail ?? response.statusText;
      this.logger.warn(`Bachs API ${options?.method ?? 'GET'} ${path} failed: ${detail}`);
      throw new BachsApiError(detail || 'bachs_api_error', payload.error_code, response.status);
    }

    return payload;
  }
}
