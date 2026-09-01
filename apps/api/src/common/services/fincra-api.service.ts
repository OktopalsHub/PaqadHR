import { Injectable, Logger } from '@nestjs/common';
import {
  getFincraApiKey,
  getFincraBaseUrl,
  getFincraBusinessId,
  getFincraPublicKey,
  isFincraCheckoutConfigured,
  isFincraConfigured,
  mapFincraCountryToSourceCurrency,
} from '../config/fincra.config';
import {
  defaultFincraBeneficiaryCountry,
  isFincraOperationPending,
  isFincraOperationSuccessful,
  isFincraPayoutNotFound,
  isFincraPayoutTerminalFailure,
  normalizeFincraPayoutStatus,
  resolveFincraFiatPaymentScheme,
  resolveFincraPaymentScheme,
} from '../config/fincra-api.util';
import {
  parseFincraPayinWebhook,
  parseFincraPayoutWebhook,
  verifyFincraWebhookSignature,
} from '../config/fincra-webhook.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';

interface FincraApiResponse<T = unknown> {
  success?: boolean;
  status?: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: T;
}

interface FincraHttpResult<T> {
  parsed: FincraApiResponse<T>;
  httpStatus: number;
}

export interface FincraInitiatePayoutInput {
  amount: number;
  destinationCurrency: string;
  customerReference: string;
  description?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  countryCode?: string;
  walletAddress?: string;
  cryptoNetwork?: string;
  sourceCurrency?: string;
  sortCode?: string;
  bankSwiftCode?: string;
  paymentScheme?: string;
  customerEmail?: string;
}

export interface FincraQuoteResult {
  reference: string;
  sourceAmount: number;
  destinationAmount: number;
  amountToCharge?: number;
}

export interface FincraCreatePayinCheckoutInput {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FincraApiService {
  private readonly logger = new Logger(FincraApiService.name);
  private static readonly REQUEST_TIMEOUT_MS = 90_000;
  private businessProfileCache: { id: string; country?: string } | null = null;

  isConfigured(): boolean {
    return isFincraConfigured();
  }

  isCheckoutConfigured(): boolean {
    return isFincraCheckoutConfigured();
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyFincraWebhookSignature(rawBody, signature);
  }

  parsePayoutWebhook(payload: unknown) {
    return parseFincraPayoutWebhook(payload);
  }

  parsePayinWebhook(payload: unknown) {
    return parseFincraPayinWebhook(payload);
  }

  async generateQuote(input: {
    sourceCurrency: string;
    destinationCurrency: string;
    amount: number;
    paymentDestination: 'bank_account' | 'crypto_wallet';
    paymentScheme?: string;
  }): Promise<FincraQuoteResult | null> {
    const businessId = await this.resolveBusinessId();
    const body: Record<string, unknown> = {
      sourceCurrency: input.sourceCurrency.toUpperCase(),
      destinationCurrency: input.destinationCurrency.toUpperCase(),
      amount: String(input.amount),
      action: 'send',
      transactionType: 'disbursement',
      business: businessId,
      paymentDestination: input.paymentDestination,
      beneficiaryType: 'individual',
      feeBearer: 'business',
    };
    if (input.paymentScheme) {
      body.paymentScheme = input.paymentScheme;
    }

    const { parsed: response } = await this.request<{
      reference?: string;
      sourceAmount?: number;
      destinationAmount?: number;
      amountToCharge?: number;
    }>('POST', '/quotes/generate', body);

    const data = response.data;
    if (!data?.reference) return null;

    return {
      reference: data.reference,
      sourceAmount: Number(data.sourceAmount ?? data.amountToCharge ?? input.amount),
      destinationAmount: Number(data.destinationAmount ?? input.amount),
      amountToCharge: data.amountToCharge != null ? Number(data.amountToCharge) : undefined,
    };
  }

  async initiatePayout(input: FincraInitiatePayoutInput): Promise<{
    success: boolean;
    reference?: string;
    status?: string;
    message?: string;
    sourceAmount?: number;
    destinationAmount?: number;
  }> {
    const existing = await this.getPayoutStatus(input.customerReference);
    if (existing?.status) {
      const normalized = normalizeFincraPayoutStatus(existing.status);
      if (isFincraOperationSuccessful(normalized) || isFincraOperationPending(normalized)) {
        return {
          success: true,
          reference: existing.reference ?? input.customerReference,
          status: normalized,
          destinationAmount: input.amount,
        };
      }
      if (isFincraPayoutTerminalFailure(normalized)) {
        return {
          success: false,
          reference: existing.reference ?? input.customerReference,
          status: normalized,
          message:
            'Customer reference already used for a terminal payout; submit a retry reference suffix',
        };
      }
    }

    const destinationCurrency = input.destinationCurrency.toUpperCase();
    const sourceCurrency = (
      input.sourceCurrency ?? (await this.resolvePayoutSourceCurrency())
    ).toUpperCase();
    const isCrypto = isCryptoCurrency(destinationCurrency);
    const paymentDestination = isCrypto ? 'crypto_wallet' : 'bank_account';
    const country = input.countryCode ?? defaultFincraBeneficiaryCountry(destinationCurrency);
    const paymentScheme =
      input.paymentScheme ??
      (isCrypto
        ? resolveFincraPaymentScheme(destinationCurrency, input.cryptoNetwork)
        : resolveFincraFiatPaymentScheme(destinationCurrency, country));

    let quoteReference: string | undefined;
    let payoutAmount = input.amount;
    let quotedSourceAmount: number | undefined;
    let quotedDestinationAmount: number | undefined;

    if (sourceCurrency !== destinationCurrency) {
      const quote = await this.generateQuote({
        sourceCurrency,
        destinationCurrency,
        amount: input.amount,
        paymentDestination,
        paymentScheme,
      });
      if (!quote) {
        return { success: false, message: 'Failed to generate Fincra quote' };
      }
      quoteReference = quote.reference;
      payoutAmount = quote.amountToCharge ?? quote.sourceAmount;
      quotedSourceAmount = quote.sourceAmount;
      quotedDestinationAmount = quote.destinationAmount;
    }

    const [firstName, ...restName] = (input.accountName ?? 'Payroll Recipient').trim().split(/\s+/);
    const lastName = restName.join(' ') || firstName;

    const beneficiary: Record<string, unknown> = isCrypto
      ? {
          walletAddress: input.walletAddress,
          accountHolderName: input.accountName ?? 'Payroll Recipient',
          type: 'individual',
        }
      : {
          firstName,
          lastName,
          accountHolderName: input.accountName ?? `${firstName} ${lastName}`.trim(),
          type: 'individual',
          country,
          accountNumber: input.accountNumber,
          email: input.customerEmail ?? 'payroll@paqad.local',
        };

    if (!isCrypto) {
      const currency = destinationCurrency;
      if (currency === 'GBP') {
        if (input.sortCode) beneficiary.sortCode = input.sortCode;
        else if (input.bankCode) beneficiary.sortCode = input.bankCode;
      } else if (currency === 'EUR') {
        if (input.bankSwiftCode) beneficiary.bankSwiftCode = input.bankSwiftCode;
        else if (input.bankCode) beneficiary.bankSwiftCode = input.bankCode;
      } else if (currency === 'USD') {
        if (input.bankCode) beneficiary.bankCode = input.bankCode;
        if (input.bankSwiftCode) beneficiary.bankSwiftCode = input.bankSwiftCode;
      } else if (input.bankCode) {
        beneficiary.bankCode = input.bankCode;
      }
    }

    const payload: Record<string, unknown> = {
      business: await this.resolveBusinessId(),
      sourceCurrency,
      destinationCurrency,
      amount: payoutAmount,
      description: input.description ?? 'Payroll disbursement',
      paymentDestination,
      customerReference: input.customerReference,
      beneficiary,
    };
    if (quoteReference) {
      payload.quoteReference = quoteReference;
    }
    if (paymentScheme) {
      payload.paymentScheme = paymentScheme;
    }

    const { parsed: response } = await this.request<{
      reference?: string;
      status?: string;
      customerReference?: string;
    }>('POST', '/disbursements/payouts', payload);

    const data = response.data;
    const status = normalizeFincraPayoutStatus(data?.status);
    const accepted = response.success === true || response.status === true;
    return {
      success: accepted && !status.includes('FAILED'),
      reference: data?.reference ?? input.customerReference,
      status,
      message: response.message,
      sourceAmount: quotedSourceAmount,
      destinationAmount: quotedDestinationAmount ?? input.amount,
    };
  }

  async getPayoutStatus(customerReference: string): Promise<{
    status: string;
    reference?: string;
    amount?: number;
  } | null> {
    const encoded = encodeURIComponent(customerReference);
    const { parsed: response, httpStatus } = await this.request<{
      status?: string;
      reference?: string;
      amountReceived?: number;
      customerReference?: string;
    }>('GET', `/disbursements/payouts/customer-reference/${encoded}`);

    const data = response.data;
    if (data) {
      return {
        status: normalizeFincraPayoutStatus(data.status),
        reference: data.reference,
        amount: data.amountReceived,
      };
    }

    if (isFincraPayoutNotFound(httpStatus, response)) {
      return null;
    }

    const detail = response.message ?? `HTTP ${httpStatus}`;
    throw new Error(`Fincra payout status lookup failed: ${detail}`);
  }

  async lookupBankAccount(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName?: string } | null> {
    const { parsed: response } = await this.request<{
      accountName?: string;
      accountNumber?: string;
    }>('POST', '/core/accounts/resolve', {
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      type: 'nuban',
    });
    if (!response.success && response.status !== true) {
      return null;
    }
    return { accountName: response.data?.accountName };
  }

  async createPayinCheckout(input: FincraCreatePayinCheckoutInput): Promise<{
    checkoutLink: string;
    orderReference: string;
  }> {
    const currency = input.currency.toUpperCase();
    const { parsed: response } = await this.request<{ link?: string; reference?: string }>(
      'POST',
      '/checkout/payments',
      {
        currency,
        amount: input.amount,
        customer: {
          name: input.customerName,
          email: input.customerEmail,
        },
        reference: input.reference,
        redirectUrl: input.redirectUrl,
        settlementDestination: 'wallet',
        feeBearer: 'business',
        metadata: input.metadata ?? {},
      },
      { usePublicKey: true },
    );

    const link = response.data?.link;
    if (!link) {
      throw new Error(response.message || 'Fincra checkout link missing');
    }

    return {
      checkoutLink: link,
      orderReference: input.reference,
    };
  }

  async verifyPayinStatus(merchantReference: string): Promise<{
    status: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  } | null> {
    const encoded = encodeURIComponent(merchantReference);
    const { parsed: response } = await this.request<{
      status?: string;
      amount?: number;
      metadata?: Record<string, unknown>;
    }>('GET', `/checkout/payments/merchant-reference/${encoded}`, undefined, {
      includeBusinessId: true,
    });

    const data = response.data;
    if (!data) return null;

    const status = (data.status ?? '').toLowerCase();
    return {
      status: isFincraOperationSuccessful(status) ? 'success' : status,
      amount: data.amount,
      metadata: data.metadata,
    };
  }

  isOperationSuccessful(status?: string | null): boolean {
    return isFincraOperationSuccessful(status);
  }

  isOperationPending(status?: string | null): boolean {
    return isFincraOperationPending(status);
  }

  /** Explicit FINCRA_BUSINESS_ID env, or `_id` from GET /profile/business/me (cached). */
  async resolveBusinessId(): Promise<string> {
    const explicit = getFincraBusinessId();
    if (explicit) {
      return explicit;
    }
    return (await this.loadBusinessProfile()).id;
  }

  /** FINCRA_PAYOUT_SOURCE_CURRENCY env, or currency inferred from business country (default NGN). */
  async resolvePayoutSourceCurrency(): Promise<string> {
    const explicit = process.env.FINCRA_PAYOUT_SOURCE_CURRENCY?.trim();
    if (explicit) {
      return explicit.toUpperCase();
    }
    const profile = await this.loadBusinessProfile();
    return mapFincraCountryToSourceCurrency(profile.country);
  }

  private async loadBusinessProfile(): Promise<{ id: string; country?: string }> {
    if (this.businessProfileCache) {
      return this.businessProfileCache;
    }

    const apiKey = getFincraApiKey();
    if (!apiKey) {
      throw new Error('Fincra API key is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FincraApiService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${getFincraBaseUrl()}/profile/business/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'api-key': apiKey,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: FincraApiResponse<{ _id?: string; country?: string }> = {};
      try {
        parsed = text
          ? (JSON.parse(text) as FincraApiResponse<{ _id?: string; country?: string }>)
          : {};
      } catch {
        this.logger.warn('Fincra business profile non-JSON response');
      }

      if (!response.ok) {
        const detail = parsed.message ?? `HTTP ${response.status}`;
        throw new Error(`Fincra business profile lookup failed: ${detail}`);
      }

      const id = parsed.data?._id?.trim();
      if (!id) {
        throw new Error(
          'Fincra business profile missing _id — set FINCRA_BUSINESS_ID if auto-resolve fails',
        );
      }

      this.businessProfileCache = { id, country: parsed.data?.country };
      return this.businessProfileCache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fincra business profile lookup error: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { usePublicKey?: boolean; includeBusinessId?: boolean },
  ): Promise<FincraHttpResult<T>> {
    const apiKey = getFincraApiKey();
    if (!apiKey) {
      throw new Error('Fincra API key is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': apiKey,
    };
    if (options?.usePublicKey) {
      const publicKey = getFincraPublicKey();
      if (!publicKey) {
        throw new Error('Fincra public key is not configured');
      }
      headers['x-pub-key'] = publicKey;
    }

    const businessId =
      getFincraBusinessId() ||
      (options?.usePublicKey || options?.includeBusinessId
        ? await this.resolveBusinessId()
        : undefined);
    if (businessId && (options?.usePublicKey || options?.includeBusinessId)) {
      headers['x-business-id'] = businessId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FincraApiService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${getFincraBaseUrl()}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: FincraApiResponse<T> = {};
      try {
        parsed = text ? (JSON.parse(text) as FincraApiResponse<T>) : {};
      } catch {
        this.logger.warn(`Fincra API non-JSON response for ${method} ${path}`);
      }

      if (!response.ok) {
        this.logger.warn(
          `Fincra API ${method} ${path} failed: ${response.status} ${parsed.message ?? text.slice(0, 200)}`,
        );
      }

      return { parsed, httpStatus: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fincra API ${method} ${path} error: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
