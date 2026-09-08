import { BadRequestException, Injectable } from '@nestjs/common';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaClientId,
  getNombaClientSecret,
  isNombaConfigured,
} from '../config/nomba.config';
import { isNombaAcceptedCode, resolveNombaTokenExpiresAtMs } from '../config/nomba-api.util';

interface NombaTokenResponse {
  code?: string;
  data?: { access_token?: string; expires_in?: number; expiresAt?: string; expires_at?: string };
}

@Injectable()
export class NombaAuthService {
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba payout is not configured');
    }
  }

  async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const response = await fetch(`${getNombaBaseUrl()}/v1/auth/token/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: getNombaClientId(),
        client_secret: getNombaClientSecret(),
      }),
    });

    let payload: NombaTokenResponse;
    try {
      payload = (await response.json()) as NombaTokenResponse;
    } catch {
      throw new BadRequestException('Failed to authenticate with Nomba: invalid JSON response');
    }

    const token = payload.data?.access_token;
    if (!response.ok || (payload.code && !isNombaAcceptedCode(payload.code)) || !token) {
      throw new BadRequestException(`Failed to authenticate with Nomba (${response.status})`);
    }

    this.cachedToken = { token, expiresAt: resolveNombaTokenExpiresAtMs(payload.data) };
    return token;
  }
}
