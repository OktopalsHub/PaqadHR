import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getNombaAccountId, getNombaBaseUrl, isNombaConfigured } from '../config/nomba.config';
import { NombaTransferApiService } from './nomba-transfer-api.service';

export interface NombaVirtualAccountResult {
  accountNumber: string;
  accountName: string;
  bankName: string;
  accountRef: string;
  accountHolderId?: string;
}

interface NombaVirtualAccountResponse {
  code?: string;
  description?: string;
  data?: {
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    accountRef?: string;
    accountHolderId?: string;
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
        this.logger.warn(`VA ref ${input.accountRef} exists — fetching existing account`);
        return this.fetchVirtualAccount(input.accountRef);
      }
      throw error;
    }
  }

  async fetchVirtualAccount(identifier: string): Promise<NombaVirtualAccountResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba is not configured');
    }

    const token = await this.nombaTransferApi.getAccessToken();
    const response = await fetch(
      `${getNombaBaseUrl()}/v1/accounts/virtual/${encodeURIComponent(identifier)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          accountId: getNombaAccountId(),
        },
      },
    );

    const payload = (await response.json()) as NombaVirtualAccountResponse;
    if (!response.ok || payload.code !== '00' || !payload.data?.accountNumber) {
      throw new BadRequestException(
        payload.description || `Failed to fetch Nomba virtual account (${response.status})`,
      );
    }

    return this.mapResult(payload.data, identifier);
  }

  private async requestCreate(input: {
    accountRef: string;
    accountName: string;
    currency: 'NGN';
  }): Promise<NombaVirtualAccountResult> {
    const token = await this.nombaTransferApi.getAccessToken();
    const response = await fetch(`${getNombaBaseUrl()}/v1/accounts/virtual`, {
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
    if (!response.ok || payload.code !== '00' || !payload.data?.accountNumber) {
      throw new BadRequestException(
        payload.description || `Nomba virtual account creation failed (${response.status})`,
      );
    }

    return this.mapResult(payload.data, input.accountRef);
  }

  private mapResult(
    data: NonNullable<NombaVirtualAccountResponse['data']>,
    fallbackRef: string,
  ): NombaVirtualAccountResult {
    return {
      accountNumber: data.accountNumber!,
      accountName: data.accountName || '',
      bankName: data.bankName || 'Nomba',
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
