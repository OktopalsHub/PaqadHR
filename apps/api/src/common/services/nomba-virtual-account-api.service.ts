import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaSubAccountId,
  isNombaConfigured,
} from '../config/nomba.config';
import { isNombaAcceptedCode } from '../config/nomba-api.util';
import { NombaTransferApiService } from './nomba-transfer-api.service';

export interface NombaVirtualAccountResult {
  accountNumber: string;
  accountName: string;
  bankName: string;
  accountRef: string;
  accountHolderId?: string;
}

/** Nomba returns bankAccountNumber / bankAccountName; older shapes may use accountNumber. */
interface NombaVirtualAccountData {
  accountNumber?: string;
  bankAccountNumber?: string;
  accountName?: string;
  bankAccountName?: string;
  bankName?: string;
  accountRef?: string;
  accountHolderId?: string;
}

interface NombaVirtualAccountResponse {
  code?: string;
  description?: string;
  data?: NombaVirtualAccountData;
}

interface NombaVirtualAccountListResponse {
  code?: string;
  description?: string;
  data?: {
    results?: NombaVirtualAccountData[];
    cursor?: string;
  };
}

@Injectable()
export class NombaVirtualAccountApiService {
  private readonly logger = new Logger(NombaVirtualAccountApiService.name);

  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  async createVirtualAccount(input: {
    accountRef: string;
    accountName: string;
    currency: 'NGN';
  }): Promise<NombaVirtualAccountResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba is not configured');
    }

    try {
      return await this.requestCreate(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isDuplicateRefError(message)) {
        this.logger.warn(`VA ref ${input.accountRef} exists — looking up existing account`);
        return this.findVirtualAccountByRef(input.accountRef);
      }
      throw error;
    }
  }

  private virtualAccountCreatePath(): string {
    const subAccountId = getNombaSubAccountId();
    return subAccountId
      ? `/v1/accounts/virtual/${encodeURIComponent(subAccountId)}`
      : '/v1/accounts/virtual';
  }

  /** Lookup by bank account number (Nomba GET /v1/accounts/virtual/{virtualAcctNumber}). */
  async fetchVirtualAccount(virtualAcctNumber: string): Promise<NombaVirtualAccountResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba is not configured');
    }

    const token = await this.nombaTransferApi.getAccessToken();
    const response = await fetch(
      `${getNombaBaseUrl()}/v1/accounts/virtual/${encodeURIComponent(virtualAcctNumber)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          accountId: getNombaAccountId(),
        },
      },
    );

    const payload = (await response.json()) as NombaVirtualAccountResponse;
    const mapped = payload.data ? this.mapResult(payload.data, virtualAcctNumber) : null;
    if (!response.ok || !isNombaAcceptedCode(payload.code) || !mapped) {
      throw new BadRequestException(
        payload.description || `Failed to fetch Nomba virtual account (${response.status})`,
      );
    }

    return mapped;
  }

  /** Recover an existing VA by our accountRef (POST /v1/accounts/virtual/list). */
  async findVirtualAccountByRef(accountRef: string): Promise<NombaVirtualAccountResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba is not configured');
    }

    const token = await this.nombaTransferApi.getAccessToken();
    const response = await fetch(`${getNombaBaseUrl()}/v1/accounts/virtual/list?limit=10`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({ accountRef }),
    });

    const payload = (await response.json()) as NombaVirtualAccountListResponse;
    const match = payload.data?.results?.find((row) => row.accountRef === accountRef);
    const mapped = match ? this.mapResult(match, accountRef) : null;
    if (!response.ok || !isNombaAcceptedCode(payload.code) || !mapped) {
      throw new BadRequestException(
        payload.description ||
          `Failed to find Nomba virtual account for ref ${accountRef} (${response.status})`,
      );
    }

    return mapped;
  }

  private async requestCreate(input: {
    accountRef: string;
    accountName: string;
    currency: 'NGN';
  }): Promise<NombaVirtualAccountResult> {
    const token = await this.nombaTransferApi.getAccessToken();
    const response = await fetch(`${getNombaBaseUrl()}${this.virtualAccountCreatePath()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({
        accountRef: input.accountRef,
        accountName: input.accountName,
        currency: input.currency,
      }),
    });

    const payload = (await response.json()) as NombaVirtualAccountResponse;
    const mapped = payload.data ? this.mapResult(payload.data, input.accountRef) : null;
    if (!response.ok || !isNombaAcceptedCode(payload.code) || !mapped) {
      throw new BadRequestException(
        payload.description || `Nomba virtual account creation failed (${response.status})`,
      );
    }

    return mapped;
  }

  private mapResult(
    data: NombaVirtualAccountData,
    fallbackRef: string,
  ): NombaVirtualAccountResult | null {
    const accountNumber = (data.bankAccountNumber || data.accountNumber || '').trim();
    if (!accountNumber) {
      return null;
    }

    return {
      accountNumber,
      accountName: (data.bankAccountName || data.accountName || '').trim(),
      bankName: (data.bankName || 'Nomba').trim(),
      accountRef: data.accountRef || fallbackRef,
      accountHolderId: data.accountHolderId,
    };
  }

  private isDuplicateRefError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('duplicate') || lower.includes('already exist') || lower.includes('exists')
    );
  }
}
