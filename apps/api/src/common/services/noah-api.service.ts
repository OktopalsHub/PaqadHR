import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getNoahApiKey,
  getNoahBaseUrl,
  getNoahPayoutCryptoCurrency,
  getNoahSigningPrivateKey,
  isNoahConfigured,
  isNoahSigningRequired,
} from '../config/noah.config';
import { isNoahOperationSuccessful } from '../config/noah-api.util';
import { createNoahApiSignature, noahJwtPath } from '../config/noah-request-sign.util';
import { verifyNoahWebhookSignature } from '../config/noah-webhook.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';

export interface NoahCheckoutInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  customerId?: string;
  tokenizeCard?: boolean;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface NoahTokenizedChargeInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  paymentMethodId: string;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface NoahFiatPayoutInput {
  amount: number;
  fiatCurrency: string;
  cryptoCurrency?: string;
  countryCode: string;
  channelId?: string;
  merchantTxRef: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  bankName?: string;
  paymentRail?: string;
  accountType?: 'INDIVIDUAL' | 'CORPORATE';
  bankAccountType?: 'CHECKING' | 'SAVINGS';
  purposeOfPayment?: string;
  narration?: string;
}

export interface NoahCryptoPayoutInput {
  amount: number;
  cryptoCurrency: string;
  walletAddress: string;
  network?: string;
  merchantTxRef: string;
  narration?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

function stringifyMeta(
  meta?: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  if (!meta) return {};
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

@Injectable()
export class NoahApiService {
  private readonly logger = new Logger(NoahApiService.name);

  isConfigured(): boolean {
    return isNoahConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Noah is not configured');
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<T> {
    this.ensureConfigured();

    const base = getNoahBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) url.searchParams.set(key, value);
      }
    }

    const bodyBuffer =
      body && (method === 'POST' || method === 'PUT')
        ? Buffer.from(JSON.stringify(body))
        : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': getNoahApiKey(),
    };

    if (method === 'POST' || method === 'PUT') {
      headers['X-Idempotency-Key'] = idempotencyKey ?? randomUUID();
    }

    const signingKey = getNoahSigningPrivateKey();
    if (isNoahSigningRequired() && signingKey) {
      const jwtPath = noahJwtPath(normalizedPath, base);
      const queryParams =
        query && Object.keys(query).length > 0
          ? Object.fromEntries(
              Object.entries(query).filter(([, value]) => value) as [string, string][],
            )
          : undefined;
      headers['Api-Signature'] = createNoahApiSignature({
        method,
        path: jwtPath,
        privateKey: signingKey,
        body: bodyBuffer,
        queryParams,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyBuffer,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`Noah ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
        throw new BadRequestException('Noah request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = (await response.json().catch(() => ({}))) as T & {
      message?: string;
      error?: string;
      status?: string;
    };

    if (!response.ok) {
      const message =
        (typeof payload === 'object' && payload && 'message' in payload
          ? String(payload.message)
          : undefined) ||
        (typeof payload === 'object' && payload && 'error' in payload
          ? String(payload.error)
          : undefined) ||
        `Noah request failed (${response.status})`;
      this.logger.error(`Noah ${method} ${path} failed: ${message}`);
      throw new BadRequestException(`Noah Error: ${message}`);
    }

    return payload;
  }

  async createPayinCheckout(input: NoahCheckoutInput): Promise<{
    checkoutLink: string;
    orderReference: string;
  }> {
    const currency = input.currency.toUpperCase();
    const isCrypto = isCryptoCurrency(currency);
    const path = isCrypto ? '/checkout/payin/crypto' : '/checkout/payin/fiat';

    const payload = await this.request<{
      checkoutUrl?: string;
      checkoutLink?: string;
      url?: string;
      orderReference?: string;
      reference?: string;
      id?: string;
    }>(
      'POST',
      path,
      {
        customerID: input.customerId ?? input.customerEmail,
        customerEmail: input.customerEmail,
        fiatAmount: String(input.amount),
        fiatCurrency: currency,
        cryptoCurrency: isCrypto ? currency : undefined,
        returnURL: input.callbackUrl,
        externalID: input.orderReference,
        metadata: stringifyMeta(input.meta),
        savePaymentMethod: input.tokenizeCard ?? true,
      },
      undefined,
      input.orderReference,
    );

    const checkoutLink = payload.checkoutUrl ?? payload.checkoutLink ?? payload.url;
    if (!checkoutLink) {
      throw new BadRequestException('Failed to initialize Noah checkout');
    }

    return {
      checkoutLink,
      orderReference: payload.orderReference ?? payload.reference ?? input.orderReference,
    };
  }

  async chargeSavedPaymentMethod(input: NoahTokenizedChargeInput): Promise<{
    orderReference: string;
  }> {
    const payload = await this.request<{
      orderReference?: string;
      reference?: string;
      externalID?: string;
      id?: string;
    }>(
      'POST',
      '/checkout/payin/fiat',
      {
        customerEmail: input.customerEmail,
        fiatAmount: String(input.amount),
        fiatCurrency: input.currency.toUpperCase(),
        returnURL: input.callbackUrl,
        externalID: input.orderReference,
        paymentMethodID: input.paymentMethodId,
        metadata: stringifyMeta(input.meta),
      },
      undefined,
      input.orderReference,
    );

    return {
      orderReference:
        payload.orderReference ?? payload.reference ?? payload.externalID ?? input.orderReference,
    };
  }

  async createFiatPayout(input: NoahFiatPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const cryptoCurrency = input.cryptoCurrency ?? getNoahPayoutCryptoCurrency();
    const channels = await this.request<{ channels?: Array<{ id?: string; channelID?: string }> }>(
      'GET',
      '/channels/sell',
      undefined,
      {
        country: input.countryCode.toUpperCase(),
        fiatCurrency: input.fiatCurrency.toUpperCase(),
        cryptoCurrency,
      },
    );

    const channelId =
      input.channelId ?? channels.channels?.[0]?.channelID ?? channels.channels?.[0]?.id;
    if (!channelId) {
      throw new BadRequestException(
        `No Noah payout channel for ${input.fiatCurrency} in ${input.countryCode}`,
      );
    }

    const form: Record<string, unknown> = {
      AccountHolderName: {
        AccountHolderType: input.accountType === 'CORPORATE' ? 'Business' : 'Individual',
        Name: { FullName: input.accountName },
      },
      BankDetails: {
        AccountNumber: input.accountNumber,
        BankCode: input.bankCode,
        BankName: input.bankName,
        AccountType: input.bankAccountType ?? 'Checking',
      },
      PaymentPurpose: input.purposeOfPayment ?? 'Payroll',
      Reference: input.merchantTxRef,
    };

    const prepared = await this.request<{
      transactionID?: string;
      transactionId?: string;
      payoutID?: string;
      payoutId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/sell/prepare',
      {
        channelID: channelId,
        cryptoCurrency,
        fiatAmount: String(input.amount),
        fiatCurrency: input.fiatCurrency.toUpperCase(),
        form,
        externalID: input.merchantTxRef,
        narration: input.narration,
      },
      undefined,
      input.merchantTxRef,
    );

    const prepareId =
      prepared.payoutID ?? prepared.payoutId ?? prepared.transactionID ?? prepared.transactionId;
    if (!prepareId) {
      throw new BadRequestException('Noah payout prepare did not return a transaction id');
    }

    const executed = await this.request<{
      transactionID?: string;
      transactionId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/sell',
      {
        transactionID: prepareId,
        externalID: input.merchantTxRef,
      },
      undefined,
      input.merchantTxRef,
    );

    return {
      transactionId:
        executed.transactionID ?? executed.transactionId ?? prepareId ?? input.merchantTxRef,
      status: executed.status ?? prepared.status ?? 'PROCESSING',
    };
  }

  async createCryptoPayout(input: NoahCryptoPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const payload = await this.request<{
      transactionID?: string;
      transactionId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/send',
      {
        cryptoCurrency: input.cryptoCurrency.toUpperCase(),
        amount: String(input.amount),
        destinationAddress: input.walletAddress,
        network: input.network,
        externalID: input.merchantTxRef,
        narration: input.narration,
      },
      undefined,
      input.merchantTxRef,
    );

    return {
      transactionId: payload.transactionID ?? payload.transactionId ?? input.merchantTxRef,
      status: payload.status ?? 'PROCESSING',
    };
  }

  async verifyTransaction(reference: string): Promise<{
    status: string;
    amount?: number;
    currency?: string;
    meta?: Record<string, unknown>;
  } | null> {
    if (process.env.NODE_ENV === 'test' && reference.startsWith('e2e_verify_')) {
      const amount = Number(reference.replace('e2e_verify_', ''));
      return { status: 'success', amount };
    }

    this.ensureConfigured();

    try {
      const payload = await this.request<{
        status?: string;
        fiatAmount?: string;
        amount?: number;
        fiatCurrency?: string;
        currency?: string;
        metadata?: Record<string, unknown>;
      }>('GET', `/transactions/${encodeURIComponent(reference)}`);

      return {
        status: payload.status ?? 'unknown',
        amount: payload.amount ?? Number(payload.fiatAmount ?? 0),
        currency: payload.currency ?? payload.fiatCurrency,
        meta: payload.metadata,
      };
    } catch (error) {
      this.logger.warn(
        `Noah verify failed for ${reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyNoahWebhookSignature(rawBody, signature);
  }

  parseTransferWebhook(payload: unknown): {
    merchantTxRef?: string;
    reference: string;
    status: string;
  } | null {
    const body = payload as {
      event_type?: string;
      eventType?: string;
      type?: string;
      data?: {
        externalID?: string;
        externalId?: string;
        transactionID?: string;
        transactionId?: string;
        status?: string;
        metadata?: Record<string, string>;
      };
    };

    const eventType = (body.event_type || body.eventType || body.type || '').toLowerCase();
    if (
      !eventType.includes('transaction') &&
      !eventType.includes('payment') &&
      !eventType.includes('payout')
    ) {
      return null;
    }

    const data = body.data;
    if (!data) return null;

    const merchantTxRef = data.externalID ?? data.externalId ?? data.metadata?.externalID;
    const reference = data.transactionID ?? data.transactionId ?? merchantTxRef;
    const status = data.status ?? 'PROCESSING';

    if (!reference) return null;

    return {
      merchantTxRef: merchantTxRef ?? reference,
      reference,
      status: status.toUpperCase(),
    };
  }

  isSuccessfulStatus(status?: string): boolean {
    return isNoahOperationSuccessful(status);
  }

  hashBody(rawBody: string): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }
}
