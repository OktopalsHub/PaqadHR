import { Buffer } from 'node:buffer';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  responseBody?: {
    accessToken?: string;
    expiresIn?: number;
  };
}

interface MonnifyAccountEntry {
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
}

interface MonnifyReservedAccountResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseBody?: {
    accountReference?: string;
    accountName?: string;
    currencyCode?: string;
    customerEmail?: string;
    customerName?: string;
    accounts?: MonnifyAccountEntry[];
    accountNumber?: string;
    bankName?: string;
  };
}

interface MonnifyInitTransactionResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
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
  };
}

interface MonnifyDisbursementResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseBody?: {
    amount?: number;
    reference?: string;
    status?: string;
    totalFee?: number;
    transactionDescription?: string;
  };
}

export interface MonnifyReservedAccountInput {
  accountReference: string;
  accountName: string;
  customerName: string;
  customerEmail: string;
  currencyCode?: string;
  customerBvn?: string;
  customerNin?: string;
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
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Monnify is not configured');
    }
  }

  private monnifyFetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(MonnifyApiService.REQUEST_TIMEOUT_MS),
    });
  }

  private async getAccessToken(): Promise<string> {
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
      throw new BadRequestException(
        payload.responseMessage || `Failed to authenticate with Monnify (${response.status})`,
      );
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

  async createReservedAccount(input: MonnifyReservedAccountInput): Promise<{
    accountReference: string;
    accountNumber: string;
    bankName: string;
    accountName: string;
  }> {
    this.ensureConfigured();

    if (!input.customerBvn && !input.customerNin) {
      throw new BadRequestException('A workspace BVN or NIN is required to create a bank account');
    }

    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(`${getMonnifyBaseUrl()}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountReference: input.accountReference,
        accountName: input.accountName,
        currencyCode: (input.currencyCode || 'NGN').toUpperCase(),
        contractCode: getMonnifyContractCode(),
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        getAllAvailableBanks: false,
        customerBVN: input.customerBvn,
        customerNIN: input.customerNin,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as MonnifyReservedAccountResponse;
    if (!response.ok || payload.requestSuccessful === false) {
      const message =
        payload.responseMessage || `Failed to create Monnify reserved account (${response.status})`;
      this.logger.error(`Monnify reserved account failed: ${message}`);
      throw new BadRequestException(message);
    }

    const account = payload.responseBody?.accounts?.[0];
    const accountNumber = account?.accountNumber ?? payload.responseBody?.accountNumber;
    const bankName = account?.bankName ?? payload.responseBody?.bankName;
    const accountName =
      account?.accountName ?? payload.responseBody?.accountName ?? input.accountName;
    const accountReference = payload.responseBody?.accountReference ?? input.accountReference;

    if (!accountNumber || !bankName) {
      throw new BadRequestException('Monnify did not return a reserved account number');
    }

    return {
      accountReference,
      accountNumber,
      bankName,
      accountName,
    };
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
          metaData: input.metaData ?? {},
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyInitTransactionResponse;
    const body = payload.responseBody;
    const checkoutUrl = body?.checkoutUrl;
    const paymentReference = body?.paymentReference ?? input.paymentReference;
    const transactionReference = body?.transactionReference ?? paymentReference;

    if (!response.ok || payload.requestSuccessful === false || !checkoutUrl) {
      throw new BadRequestException(
        payload.responseMessage || `Failed to initialize Monnify checkout (${response.status})`,
      );
    }

    return { checkoutUrl, transactionReference, paymentReference };
  }

  async verifyTransaction(paymentReference: string): Promise<{
    paid: boolean;
    amount: number;
    currency: string;
    customerEmail?: string;
    metaData?: Record<string, unknown>;
  } | null> {
    this.ensureConfigured();
    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(
      `${getMonnifyBaseUrl()}/api/v2/transactions/${encodeURIComponent(paymentReference)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.status === 404) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as MonnifyTransactionStatusResponse;
    const body = payload.responseBody;
    if (!response.ok || payload.requestSuccessful === false || !body) {
      throw new BadRequestException(
        payload.responseMessage || `Monnify transaction lookup failed (${response.status})`,
      );
    }

    const status = String(body.paymentStatus ?? '').toUpperCase();
    const paid = status === 'PAID' || status === 'SUCCESS' || status === 'SUCCESSFUL';
    const amount = Number(body.amountPaid ?? body.totalPayable ?? 0);

    return {
      paid,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: (body.currency || 'NGN').toUpperCase(),
      customerEmail: body.customer?.email,
      metaData: body.metaData,
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
      Boolean(status) &&
      ['SUCCESS', 'SUCCESSFUL', 'PENDING', 'PROCESSING'].includes(status);

    return {
      success,
      reference: body?.reference ?? input.reference,
      status,
      message: payload.responseMessage,
    };
  }
}
