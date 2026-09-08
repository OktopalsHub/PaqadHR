import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getMonnifyApiKey,
  getMonnifyBaseUrl,
  getMonnifyContractCode,
} from '../config/monnify.config';
import { MonnifyAuthService } from './monnify-auth.service';

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

@Injectable()
export class MonnifyCheckoutService {
  private readonly logger = new Logger(MonnifyCheckoutService.name);
  private static readonly CHECKOUT_UNAVAILABLE =
    'Checkout is temporarily unavailable. Please try again later or contact support.';

  constructor(private readonly auth: MonnifyAuthService) {}

  mapVerifiedTransaction(body: NonNullable<MonnifyTransactionStatusResponse['responseBody']>): {
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

  async initializeTransaction(input: MonnifyInitCheckoutInput): Promise<{
    checkoutUrl: string;
    transactionReference: string;
    paymentReference: string;
  }> {
    this.auth.ensureConfigured();
    const token = await this.auth.getAccessToken();
    const response = await this.auth.monnifyFetch(
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
          metaData: this.auth.stringifyMeta(input.metaData),
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyInitTransactionResponse;
    const body = payload.responseBody;
    const checkoutUrl = body?.checkoutUrl;
    const paymentReference = body?.paymentReference ?? input.paymentReference;
    const transactionReference = body?.transactionReference ?? paymentReference;

    if (!response.ok || payload.requestSuccessful === false || !checkoutUrl) {
      this.auth.logMonnifyResponse(
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
      throw new BadRequestException(MonnifyCheckoutService.CHECKOUT_UNAVAILABLE);
    }

    this.logger.debug(
      `Monnify checkout-init ok paymentReference=${paymentReference} transactionReference=${transactionReference}`,
    );

    return { checkoutUrl, transactionReference, paymentReference };
  }

  async verifyTransaction(
    paymentReference: string,
    transactionReference?: string,
  ): Promise<ReturnType<MonnifyCheckoutService['mapVerifiedTransaction']> | null> {
    this.auth.ensureConfigured();
    const token = await this.auth.getAccessToken();

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
  ): Promise<ReturnType<MonnifyCheckoutService['mapVerifiedTransaction']> | null> {
    const url = `${getMonnifyBaseUrl()}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`;
    return this.queryTransaction(token, url, 'verify-paymentReference', { paymentReference });
  }

  private async queryByTransactionReference(
    token: string,
    transactionReference: string,
  ): Promise<ReturnType<MonnifyCheckoutService['mapVerifiedTransaction']> | null> {
    const url = `${getMonnifyBaseUrl()}/api/v2/transactions/${encodeURIComponent(transactionReference)}`;
    return this.queryTransaction(token, url, 'verify-transactionReference', {
      transactionReference,
    });
  }

  private async queryTransaction(
    token: string,
    url: string,
    operation: string,
    extra: Record<string, string>,
  ): Promise<ReturnType<MonnifyCheckoutService['mapVerifiedTransaction']> | null> {
    const response = await this.auth.monnifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    const payload = (await response.json().catch(() => ({}))) as MonnifyTransactionStatusResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      this.auth.logMonnifyResponse(operation, url, response.status, payload, extra);
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
    this.auth.ensureConfigured();
    const token = await this.auth.getAccessToken();
    const response = await this.auth.monnifyFetch(
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
          metaData: this.auth.stringifyMeta(input.metaData),
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyChargeCardTokenResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      this.auth.logMonnifyResponse(
        'charge-card-token',
        '/api/v1/merchant/cards/charge-card-token',
        response.status,
        payload,
        { paymentReference: input.paymentReference },
      );
      throw new BadRequestException(MonnifyCheckoutService.CHECKOUT_UNAVAILABLE);
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
}
