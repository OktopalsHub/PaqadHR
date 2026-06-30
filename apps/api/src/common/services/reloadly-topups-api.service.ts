import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getReloadlyAuthUrl,
  getReloadlyClientId,
  getReloadlyClientSecret,
  isReloadlyConfigured,
  isReloadlySandbox,
} from '../config/reloadly.config';

interface ReloadlyTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface ReloadlyOperator {
  operatorId: number;
  name: string;
  bundle: boolean;
  data: boolean;
  pin: boolean;
  denominationType: string;
  senderCurrencyCode: string;
  destinationCurrencyCode: string;
  minAmount: number | null;
  maxAmount: number | null;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  country: {
    isoName: string;
    name: string;
  };
  fx: {
    rate: number;
    currencyCode: string;
  } | null;
  logoUrls: string[];
}

export interface ReloadlyFxRateResponse {
  id: number;
  name: string;
  fxRate: number;
  currencyCode: string;
}

export interface ReloadlyTopupResponse {
  transactionId: number;
  status: string;
  operatorName: string;
  countryCode: string;
  recipientPhone: string;
  senderCurrencyCode: string;
  recipientCurrencyCode: string;
  deliveredAmount: number;
  deliveredAmountCurrencyCode: string;
  transactionDate: string;
}

@Injectable()
export class ReloadlyTopupsApiService {
  private readonly logger = new Logger(ReloadlyTopupsApiService.name);
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isReloadlyConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Reloadly Topups API is not configured');
    }
  }

  private getBaseUrl(): string {
    return isReloadlySandbox()
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com';
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const audience = this.getBaseUrl();

    const response = await fetch(getReloadlyAuthUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getReloadlyClientId(),
        client_secret: getReloadlyClientSecret(),
        grant_type: 'client_credentials',
        audience,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Reloadly Topups auth failed (${response.status}): ${errorText}`);
      throw new BadRequestException(
        `Failed to authenticate with Reloadly Topups (${response.status})`,
      );
    }

    const payload = (await response.json()) as ReloadlyTokenResponse;
    const token = payload.access_token;
    if (!token) {
      throw new BadRequestException(
        'Failed to authenticate with Reloadly Topups: missing access token',
      );
    }

    const ttl = (payload.expires_in ?? 5000) * 1000;
    this.cachedToken = { token, expiresAt: Date.now() + ttl - 60_000 };
    return token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/com.reloadly.topups-v1+json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, options);
    const responseText = await response.text();

    if (!response.ok) {
      let message = `Reloadly Topups request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as { message?: string; errorCode?: string };
        if (errorPayload?.message) {
          message = errorPayload.message;
        }
      } catch {}
      this.logger.error(`Reloadly Topups ${method} ${path} failed: ${message}`);
      throw new BadRequestException(`Reloadly Topups error: ${message}`);
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Reloadly Topups error: invalid JSON response');
    }
  }

  async listOperators(countryCode: string): Promise<ReloadlyOperator[]> {
    const response = await this.request<ReloadlyOperator[]>(
      'GET',
      `/operators/countries/${countryCode.toUpperCase()}`,
    );
    return response ?? [];
  }

  async getOperatorFxRate(operatorId: number, amount: number): Promise<ReloadlyFxRateResponse> {
    return this.request<ReloadlyFxRateResponse>('POST', '/operators/fx-rate', {
      operatorId,
      amount,
    });
  }

  async topup(params: {
    operatorId: number;
    amount: number;
    recipientPhone: { countryCode: string; number: string };
    customIdentifier?: string;
  }): Promise<ReloadlyTopupResponse> {
    return this.request<ReloadlyTopupResponse>('POST', '/topups', {
      operatorId: params.operatorId,
      amount: params.amount,
      useLocalAmount: true,
      recipientPhone: params.recipientPhone,
      customIdentifier: params.customIdentifier,
    });
  }
}
