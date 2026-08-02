import { Buffer } from 'node:buffer';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getMonnifyApiKey,
  getMonnifyBaseUrl,
  getMonnifyContractCode,
  getMonnifySecretKey,
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

export interface MonnifyReservedAccountInput {
  accountReference: string;
  accountName: string;
  customerName: string;
  customerEmail: string;
  currencyCode?: string;
  customerBvn?: string;
  customerNin?: string;
}

@Injectable()
export class MonnifyApiService {
  private readonly logger = new Logger(MonnifyApiService.name);
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Monnify is not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const auth = Buffer.from(`${getMonnifyApiKey()}:${getMonnifySecretKey()}`).toString('base64');
    const response = await fetch(`${getMonnifyBaseUrl()}/api/v1/auth/login`, {
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
        Date.now() + (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
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
      throw new BadRequestException('Monnify reserved accounts require a BVN or NIN');
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${getMonnifyBaseUrl()}/api/v2/bank-transfer/reserved-accounts`, {
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
    const accountName = account?.accountName ?? payload.responseBody?.accountName ?? input.accountName;
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
}
