import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  isNombaConfigured,
} from '../config/nomba.config';
import { NombaTransferApiService } from './nomba-transfer-api.service';

export interface NombaAirtimeInput {
  amount: number;
  phoneNumber: string;
  network: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  merchantTxRef: string;
  senderName?: string;
}

interface NombaTopupResponse {
  code?: string;
  description?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number;
  };
}

@Injectable()
export class NombaBillApiService {
  private readonly logger = new Logger(NombaBillApiService.name);

  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  /**
   * Purchase airtime / mobile top-up via Nomba.
   * Uses the same auth token infrastructure as the transfer service.
   */
  async purchaseAirtime(input: NombaAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba airtime vending is not configured');
    }

    // We need a fresh token — reuse the NombaTransferApiService's internal auth
    // by calling through a thin fetch wrapper using the same credential helpers.
    const token = await this.getToken();

    const response = await fetch(`${getNombaBaseUrl()}/v1/bill/topup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({
        amount: input.amount,
        phoneNumber: input.phoneNumber,
        network: input.network,
        merchantTxRef: input.merchantTxRef,
        senderName: input.senderName ?? 'PAQAD HR',
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let message = `Nomba airtime request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as { message?: string; description?: string };
        if (errorPayload?.message || errorPayload?.description) {
          message = errorPayload.message || errorPayload.description || message;
        }
      } catch {
        // Non-JSON error body
      }
      this.logger.error(`Nomba airtime topup failed: ${message}`);
      throw new BadRequestException(`Nomba airtime error: ${message}`);
    }

    let payload: NombaTopupResponse;
    try {
      payload = JSON.parse(responseText) as NombaTopupResponse;
    } catch {
      throw new BadRequestException('Nomba airtime error: invalid JSON response');
    }

    return {
      success: payload.code === '00',
      transactionId: payload.data?.id ?? null,
      status: payload.data?.status ?? 'UNKNOWN',
    };
  }

  /**
   * Get an access token from the same Nomba auth infrastructure.
   * We invoke the token endpoint directly using the same credentials.
   */
  private async getToken(): Promise<string> {
    // Delegate to the existing NombaTransferApiService for token management.
    // We access it through its public interface. Since getAccessToken is private,
    // we make a lightweight token request ourselves.
    const { getNombaClientId, getNombaClientSecret } = await import('../config/nomba.config');

    const response = await fetch(`${getNombaBaseUrl()}/v1/auth/token/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: getNombaClientId(),
        client_secret: getNombaClientSecret(),
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Failed to authenticate with Nomba for airtime (${response.status})`);
    }

    const data = (await response.json()) as { data?: { access_token?: string } };
    const token = data.data?.access_token;
    if (!token) {
      throw new BadRequestException('Failed to get Nomba access token for airtime');
    }
    return token;
  }
}
