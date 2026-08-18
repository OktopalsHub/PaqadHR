import { Buffer } from 'node:buffer';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  getMonnifyApiKey,
  getMonnifyBaseUrl,
  getMonnifyContractCode,
  getMonnifySecretKey,
  getMonnifyWalletAccountNumber,
  isMonnifyConfigured,
} from '../config/monnify.config';

interface MonnifyAuthResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    accessToken?: string;
    expiresIn?: number;
  };
}

interface MonnifyInitTransactionResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    transactionReference?: string;
    paymentReference?: string;
    checkoutUrl?: string;
    redirectUrl?: string;
  };
}

interface MonnifyTransactionStatusResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    paymentReference?: string;
    transactionReference?: string;
    amountPaid?: string | number;
    totalPayable?: string | number;
    paidOn?: string;
    paymentStatus?: string;
    currency?: string;
    customer?: { email?: string; name?: string };
    metaData?: Record<string, unknown>;
    cardDetails?: {
      cardToken?: string;
      last4?: string;
      cardType?: string;
      supportsTokenization?: boolean;
      reusable?: boolean;
    };
  };
}

interface MonnifyChargeCardTokenResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    paymentReference?: string;
    transactionReference?: string;
    paymentStatus?: string;
    amountPaid?: string | number;
  };
}

interface MonnifyDisbursementResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    amount?: number;
    reference?: string;
    status?: string;
    totalFee?: number;
    transactionDescription?: string;
  };
}

export interface MonnifyInitCheckoutInput {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl: string;
  currencyCode?: string;
  metaData?: Record<string, unknown>;
}

export interface MonnifySingleTransferInput {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName: string;
  currencyCode?: string;
}

@Injectable()
export class MonnifyApiService {
  private readonly logger = new Logger(MonnifyApiService.name);
  private cachedToken?: { token: string; expiresAt: number };
  private static readonly REQUEST_TIMEOUT_MS = 90_000;
  private static readonly CHECKOUT_UNAVAILABLE =
    'Checkout is temporarily unavailable. Please try again later or contact support.';

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
    }
  }

  private isFetchTimeout(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.includes('timeout'))
    );
  }

  /** Safe Monnify response diagnostics — never logs tokens, keys, or customer PII. */
  private logMonnifyResponse(
    operation: string,
    path: string,
    httpStatus: number,
    payload: {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseCode?: string;
    },
    extra?: Record<string, string | boolean | number | null | undefined>,
  ): void {
    const parts = [
      `Monnify ${operation} ${path}`,
      `http=${httpStatus}`,
      `requestSuccessful=${payload.requestSuccessful ?? 'unknown'}`,
      `responseCode=${payload.responseCode ?? 'none'}`,
      `responseMessage=${payload.responseMessage ?? 'none'}`,
    ];
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        parts.push(`${key}=${value ?? 'none'}`);
      }
    }
    this.logger.warn(parts.join(' '));
  }

  private async monnifyFetch(url: string, init?: RequestInit): Promise<Response> {
    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(MonnifyApiService.REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (this.isFetchTimeout(error)) {
        this.logger.error(`Payment provider request timed out (${path})`);
        throw new ServiceUnavailableException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
      }
      this.logger.error(
        `Payment provider request failed (${path}): ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
    }
  }

  /** Monnify metaData values must be strings (API schema). */
  private stringifyMeta(meta?: Record<string, unknown>): Record<string, string> {
    if (!meta) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value == null) continue;
      out[key] = typeof value === 'string' ? value : String(value);
    }
    return out;
  }

  private mapVerifiedTransaction(
    body: NonNullable<MonnifyTransactionStatusResponse['responseBody']>,
  ): {
    paid: boolean;
    amount: number;
    currency: string;
    customerEmail?: string;
    customerName?: string;
    metaData?: Record<string, unknown>;
    cardToken?: string;
    cardLastFour?: string;
    cardBrand?: string;
    paymentReference?: string;
    transactionReference?: string;
  } {
    const status = String(body.paymentStatus ?? '').toUpperCase();
    const paid =
      status === 'PAID' || status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'OVERPAID';
    const amount = Number(body.amountPaid ?? body.totalPayable ?? 0);
    const cardToken = body.cardDetails?.cardToken?.trim() || undefined;

    return {
      paid,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: (body.currency || 'NGN').toUpperCase(),
      customerEmail: body.customer?.email,
      customerName: body.customer?.name,
      metaData: body.metaData,
      cardToken,
      cardLastFour: body.cardDetails?.last4?.slice(-4),
      cardBrand: body.cardDetails?.cardType,
      paymentReference: body.paymentReference,
      transactionReference: body.transactionReference,
    };
  }

  async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const auth = Buffer.from(`${getMonnifyApiKey()}:${getMonnifySecretKey()}`).toString('base64');
    const response = await this.monnifyFetch(`${getMonnifyBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json().catch(() => ({}))) as MonnifyAuthResponse;
    const token = payload.responseBody?.accessToken;
    if (!response.ok || payload.requestSuccessful === false || !token) {
      this.logMonnifyResponse('auth', '/api/v1/auth/login', response.status, payload);
      throw new BadRequestException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
    }

    const expiresInSeconds = Number(payload.responseBody?.expiresIn ?? 0);
    this.cachedToken = {
      token,
      expiresAt:
        Date.now() +
        (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
          ? Math.max(30, expiresInSeconds - 60) * 1000
          : 25 * 60 * 1000),
    };
    return token;
  }

  async initializeTransaction(input: MonnifyInitCheckoutInput): Promise<{
    checkoutUrl: string;
    transactionReference: string;
    paymentReference: string;
  }> {
    this.ensureConfigured();
    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(
      `${getMonnifyBaseUrl()}/api/v1/merchant/transactions/init-transaction`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amount,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          paymentReference: input.paymentReference,
          paymentDescription: input.paymentDescription,
          currencyCode: (input.currencyCode || 'NGN').toUpperCase(),
          contractCode: getMonnifyContractCode(),
          redirectUrl: input.redirectUrl,
          paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
          metaData: this.stringifyMeta(input.metaData),
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyInitTransactionResponse;
    const body = payload.responseBody;
    const checkoutUrl = body?.checkoutUrl;
    const paymentReference = body?.paymentReference ?? input.paymentReference;
    const transactionReference = body?.transactionReference ?? paymentReference;

    if (!response.ok || payload.requestSuccessful === false || !checkoutUrl) {
      this.logMonnifyResponse(
        'checkout-init',
        '/api/v1/merchant/transactions/init-transaction',
        response.status,
        payload,
        {
          hasCheckoutUrl: Boolean(checkoutUrl),
          paymentReference,
          transactionReference,
          amount: input.amount,
          currencyCode: (input.currencyCode || 'NGN').toUpperCase(),
        },
      );
      throw new BadRequestException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
    }

    this.logger.debug(
      `Monnify checkout-init ok paymentReference=${paymentReference} transactionReference=${transactionReference}`,
    );

    return { checkoutUrl, transactionReference, paymentReference };
  }

  /**
   * Verify by merchant paymentReference (preferred) with optional Monnify transactionReference fallback.
   * Soft-fails to null when not found / not yet queryable so callers can poll (PENDING).
   * @see https://developers.monnify.com/docs/collections/manage-payments/verify-transactions
   */
  async verifyTransaction(
    paymentReference: string,
    transactionReference?: string,
  ): Promise<{
    paid: boolean;
    amount: number;
    currency: string;
    customerEmail?: string;
    customerName?: string;
    metaData?: Record<string, unknown>;
    cardToken?: string;
    cardLastFour?: string;
    cardBrand?: string;
    paymentReference?: string;
    transactionReference?: string;
  } | null> {
    this.ensureConfigured();
    const token = await this.getAccessToken();

    const byPaymentRef = await this.queryByPaymentReference(token, paymentReference);
    if (byPaymentRef) {
      return byPaymentRef;
    }

    const txRef = transactionReference?.trim();
    if (txRef) {
      return this.queryByTransactionReference(token, txRef);
    }

    return null;
  }

  private async queryByPaymentReference(
    token: string,
    paymentReference: string,
  ): Promise<ReturnType<MonnifyApiService['mapVerifiedTransaction']> | null> {
    const url = `${getMonnifyBaseUrl()}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`;
    const response = await this.monnifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as MonnifyTransactionStatusResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      this.logMonnifyResponse(
        'verify-paymentReference',
        '/api/v2/merchant/transactions/query',
        response.status,
        payload,
        { paymentReference },
      );
      return null;
    }

    return this.mapVerifiedTransaction(body);
  }

  private async queryByTransactionReference(
    token: string,
    transactionReference: string,
  ): Promise<ReturnType<MonnifyApiService['mapVerifiedTransaction']> | null> {
    const url = `${getMonnifyBaseUrl()}/api/v2/transactions/${encodeURIComponent(transactionReference)}`;
    const response = await this.monnifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as MonnifyTransactionStatusResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      this.logMonnifyResponse(
        'verify-transactionReference',
        '/api/v2/transactions',
        response.status,
        payload,
        { transactionReference },
      );
      return null;
    }

    return this.mapVerifiedTransaction(body);
  }

  async chargeCardToken(input: {
    cardToken: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    paymentReference: string;
    paymentDescription: string;
    currencyCode?: string;
    metaData?: Record<string, unknown>;
  }): Promise<{ paymentReference: string; paid: boolean; amount: number }> {
    this.ensureConfigured();
    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(
      `${getMonnifyBaseUrl()}/api/v1/merchant/cards/charge-card-token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardToken: input.cardToken,
          amount: input.amount,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          paymentReference: input.paymentReference,
          paymentDescription: input.paymentDescription,
          currencyCode: (input.currencyCode || 'NGN').toUpperCase(),
          contractCode: getMonnifyContractCode(),
          apiKey: getMonnifyApiKey(),
          metaData: this.stringifyMeta(input.metaData),
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyChargeCardTokenResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      this.logMonnifyResponse(
        'charge-card-token',
        '/api/v1/merchant/cards/charge-card-token',
        response.status,
        payload,
        { paymentReference: input.paymentReference },
      );
      throw new BadRequestException(MonnifyApiService.CHECKOUT_UNAVAILABLE);
    }

    const status = String(body.paymentStatus ?? '').toUpperCase();
    const paid =
      status === 'PAID' || status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'OVERPAID';
    const amount = Number(body.amountPaid ?? input.amount);

    return {
      paymentReference: body.paymentReference ?? input.paymentReference,
      paid,
      amount: Number.isFinite(amount) ? amount : input.amount,
    };
  }

  async singleTransfer(input: MonnifySingleTransferInput): Promise<{
    success: boolean;
    reference: string;
    status?: string;
    message?: string;
  }> {
    this.ensureConfigured();
    const sourceAccountNumber = getMonnifyWalletAccountNumber();
    if (!sourceAccountNumber) {
      throw new BadRequestException('MONNIFY_WALLET_ACCOUNT_NUMBER is not configured');
    }

    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(`${getMonnifyBaseUrl()}/api/v2/disbursements/single`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        reference: input.reference,
        narration: input.narration,
        destinationBankCode: input.destinationBankCode,
        destinationAccountNumber: input.destinationAccountNumber,
        destinationAccountName: input.destinationAccountName,
        currency: (input.currencyCode || 'NGN').toUpperCase(),
        sourceAccountNumber,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as MonnifyDisbursementResponse;
    const body = payload.responseBody;
    const status = body?.status?.toUpperCase();
    const success =
      response.ok &&
      payload.requestSuccessful === true &&
      Boolean(body?.reference) &&
      status != null &&
      ['SUCCESS', 'SUCCESSFUL', 'PENDING', 'PROCESSING'].includes(status);

    return {
      success,
      reference: body?.reference ?? input.reference,
      status,
      message: payload.responseMessage,
    };
  }

  async getDisbursementStatus(
    reference: string,
  ): Promise<{ status: string | null; amount?: number; reference?: string }> {
    this.ensureConfigured();
    const token = await this.getAccessToken();
    const url = `${getMonnifyBaseUrl()}/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`;
    const response = await this.monnifyFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as MonnifyDisbursementResponse & {
      responseBody?: {
        status?: string;
        amount?: number;
        reference?: string;
        transactionStatus?: string;
      };
    };
    if (!response.ok || payload.requestSuccessful === false) {
      return { status: null };
    }
    const body = payload.responseBody;
    const status = String(body?.status ?? body?.transactionStatus ?? '').toUpperCase();
    return {
      status: status || null,
      amount: body?.amount != null ? Number(body.amount) : undefined,
      reference: body?.reference ?? reference,
    };
  }

  async lookupBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountNumber: string; accountName: string }> {
    this.ensureConfigured();
    const token = await this.getAccessToken();
    const url = `${getMonnifyBaseUrl()}/api/v2/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`;
    const response = await this.monnifyFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: {
        accountNumber?: string;
        accountName?: string;
      };
    };
    if (!response.ok || payload.requestSuccessful === false || !payload.responseBody?.accountName) {
      this.logMonnifyResponse(
        'lookup-bank-account',
        '/api/v2/disbursements/account/validate',
        response.status,
        payload,
        { accountNumber: `****${accountNumber.slice(-4)}` },
      );
      throw new BadRequestException('Could not verify this bank account');
    }
    return {
      accountNumber: payload.responseBody.accountNumber ?? accountNumber,
      accountName: payload.responseBody.accountName,
    };
  }
}
