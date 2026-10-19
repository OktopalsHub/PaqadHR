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
  name: string;
  type: 'bank_account' | 'mobile_money' | 'crypto_wallet';
  currency: string;
  status: 'pending_review' | 'approved' | 'rejected';
  status_reason?: string | null;
  is_usable: boolean;
  is_default: boolean;
  account_number?: string | null;
  account_name?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  phone_number?: string | null;
  mobile_provider?: string | null;
  wallet_address?: string | null;
  network?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
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
  private adaptivePricingEnabled: boolean | null = null;

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
    // Warn (do not block) when the chooser will not be offered on a USD checkout.
    void this.isAdaptivePricingEnabled();
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

    void this.isAdaptivePricingEnabled();
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
   * Reads the account's adaptive_pricing flag. This is an account-level setting that
   * is **read-only over the API**: `GET /v1/accounts/checkout/settings` does not return
   * it, and the matching PUT accepts only `enabled_payment_methods` and
   * `fee_preference`, so the previous PUT of `adaptive_pricing` there was always
   * rejected. Enabling it is a dashboard step under checkout settings.
   *
   * Note this only governs the price *display* and currency chooser. It does not add
   * payment rails: a recurring checkout can only be backed by a USD card today, so a
   * USD subscription correctly shows a single USD card option regardless of this flag.
   */
  async isAdaptivePricingEnabled(): Promise<boolean> {
    if (this.adaptivePricingEnabled !== null) return this.adaptivePricingEnabled;
    try {
      const account = await this.request<{
        adaptive_pricing?: boolean;
        balance_currencies?: string[];
      }>('/v1/accounts/me');
      const enabled = account?.adaptive_pricing === true;
      // Only cache a successful read, so a transient failure can recover next call.
      this.adaptivePricingEnabled = enabled;
      if (!enabled) {
        this.logger.warn(
          'Bachs adaptive pricing is OFF — one-time USD checkouts will show no local-currency ' +
            'chooser. It cannot be enabled over the API; turn it on in the Bachs dashboard under ' +
            'checkout settings. Currencies held: ' +
            `${account?.balance_currencies?.join(',') || 'unknown'}.`,
        );
      }
      return enabled;
    } catch (error) {
      this.logger.warn(
        `Could not read Bachs adaptive_pricing: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /** Paginated lookup by checkout reference for wallet top-up verification. */
  async findPaymentByReference(
    reference: string,
  ): Promise<{ status: string; amount: number; currency?: string } | null> {
    const encoded = encodeURIComponent(reference);
    // Prefer filtered lookup when supported; fall back to paging.
    try {
      const filtered = await this.request<{
        items?: Array<{
          reference?: string | null;
          status?: string;
          amount_paid?: string | null;
          amount?: string | null;
          currency?: string | null;
          billing_currency?: string | null;
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
          currency?: string | null;
          billing_currency?: string | null;
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
    currency?: string | null;
    billing_currency?: string | null;
  }): { status: string; amount: number; currency?: string } {
    const status = String(match.status ?? '').toLowerCase();
    const amount = Number(match.amount_paid ?? match.amount ?? 0);
    return {
      status,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: match.currency ?? match.billing_currency ?? undefined,
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

  /** List banks available for payout destinations in a country. */
  async listBanks(
    country: string,
  ): Promise<{ country: string; banks: Array<{ name: string; code: string }> }> {
    const params = new URLSearchParams({ country });
    return this.request<{ country: string; banks: Array<{ name: string; code: string }> }>(
      `/v1/reference/banks?${params.toString()}`,
    );
  }

  /** Resolve a bank account number and bank code to the account holder's name. */
  async resolveBankAccount(input: {
    accountNumber: string;
    bankCode: string;
    country?: string;
  }): Promise<{
    resolved: boolean;
    accountName: string | null;
    accountNumber: string | null;
    message: string | null;
  }> {
    const body: Record<string, unknown> = {
      account_number: input.accountNumber,
      bank_code: input.bankCode,
    };
    if (input.country) body.country = input.country;
    const payload = await this.request<{
      resolved: boolean;
      account_name?: string | null;
      account_number?: string | null;
      message?: string | null;
    }>('/v1/misc/bank-accounts/resolve', { method: 'POST', body });
    return {
      resolved: payload.resolved,
      accountName: payload.account_name ?? null,
      accountNumber: payload.account_number ?? null,
      message: payload.message ?? null,
    };
  }

  /** List mobile money providers available in a country. */
  async listMobileMoneyProviders(
    country: string,
  ): Promise<{ country: string; providers: string[] }> {
    const params = new URLSearchParams({ country });
    return this.request<{ country: string; providers: string[] }>(
      `/v1/reference/momo?${params.toString()}`,
    );
  }

  /** List payout destinations with optional filters. */
  async listPayoutDestinations(filters?: {
    currency?: string;
    status?: 'pending_review' | 'approved' | 'rejected';
    limit?: number;
    offset?: number;
  }): Promise<{
    destinations: BachsPayoutDestination[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.currency) params.set('currency', filters.currency);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const query = params.toString();
    return this.request<{
      destinations: BachsPayoutDestination[];
      total: number;
      limit: number;
      offset: number;
    }>(`/v1/payouts/destinations${query ? `?${query}` : ''}`);
  }

  /** Get a single payout destination by ID. */
  async getPayoutDestination(destinationId: string): Promise<BachsPayoutDestination> {
    return this.request<BachsPayoutDestination>(
      `/v1/payouts/destinations/${encodeURIComponent(destinationId)}`,
    );
  }

  /** Update a payout destination (rename, set default, or restate routing details). */
  async updatePayoutDestination(
    destinationId: string,
    updates: {
      name?: string;
      is_default?: boolean;
      currency?: string;
      type?: string;
      account_number?: string;
      bank_code?: string;
      account_name?: string;
      bank_name?: string;
      phone_number?: string;
      mobile_provider?: string;
      wallet_address?: string;
      network?: string;
    },
  ): Promise<BachsPayoutDestination> {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.is_default !== undefined) body.is_default = updates.is_default;
    if (updates.currency !== undefined) body.currency = updates.currency;
    if (updates.type !== undefined) body.type = updates.type;
    if (updates.account_number !== undefined) body.account_number = updates.account_number;
    if (updates.bank_code !== undefined) body.bank_code = updates.bank_code;
    if (updates.account_name !== undefined) body.account_name = updates.account_name;
    if (updates.bank_name !== undefined) body.bank_name = updates.bank_name;
    if (updates.phone_number !== undefined) body.phone_number = updates.phone_number;
    if (updates.mobile_provider !== undefined) body.mobile_provider = updates.mobile_provider;
    if (updates.wallet_address !== undefined) body.wallet_address = updates.wallet_address;
    if (updates.network !== undefined) body.network = updates.network;
    return this.request<BachsPayoutDestination>(
      `/v1/payouts/destinations/${encodeURIComponent(destinationId)}`,
      {
        method: 'PATCH',
        body,
      },
    );
  }

  /** Delete a payout destination (deactivates it). */
  async deletePayoutDestination(destinationId: string): Promise<{ id: string; deleted: boolean }> {
    return this.request<{ id: string; deleted: boolean }>(
      `/v1/payouts/destinations/${encodeURIComponent(destinationId)}`,
      { method: 'DELETE' },
    );
  }

  /** List payouts with optional status filter. */
  async listPayouts(filters?: {
    limit?: number;
    offset?: number;
    status_filter?:
      | 'requested'
      | 'pending'
      | 'processing'
      | 'approved'
      | 'rejected'
      | 'completed'
      | 'failed';
  }): Promise<{ total: number; items: BachsPayoutResult[] }> {
    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    if (filters?.status_filter) params.set('status_filter', filters.status_filter);
    const query = params.toString();
    return this.request<{ total: number; items: BachsPayoutResult[] }>(
      `/v1/payouts${query ? `?${query}` : ''}`,
    );
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

    const responseText = await response.text();
    let payload:
      | (T & {
          detail?: string;
          message?: string;
          error?: string | { message?: string };
          error_description?: string;
          error_code?: string;
        })
      | Record<string, unknown> = {};

    if (responseText) {
      try {
        payload = JSON.parse(responseText) as typeof payload;
      } catch {
        // Some upstream failures return plain text or an empty body instead of JSON.
        payload = {};
      }
    }

    if (!response.ok) {
      const errorPayload = payload as {
        detail?: unknown;
        message?: unknown;
        error?: unknown;
        error_description?: unknown;
        error_code?: unknown;
      };
      const nestedError =
        errorPayload.error && typeof errorPayload.error === 'object'
          ? (errorPayload.error as { message?: unknown }).message
          : errorPayload.error;
      const providerMessage = [
        errorPayload.detail,
        errorPayload.message,
        errorPayload.error_description,
        nestedError,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
      const errorCode =
        typeof errorPayload.error_code === 'string' ? errorPayload.error_code : undefined;
      const statusMessage = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      const detail = (providerMessage ?? statusMessage).trim().slice(0, 300);

      this.logger.warn(
        `Bachs API ${options?.method ?? 'GET'} ${path} failed (${statusMessage}${errorCode ? `, code=${errorCode}` : ''}): ${detail}`,
      );
      throw new BachsApiError(detail || 'bachs_api_error', errorCode, response.status);
    }

    return payload as T;
  }
}
