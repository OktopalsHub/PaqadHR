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

export interface ReloadlyBiller {
  id: number;
  name: string;
  countryIsoCode: string;
  type: string; // e.g. ELECTRICITY_BILL_PAYMENT
  serviceType: 'POSTPAID' | 'PREPAID';
  localAmountSupported: boolean;
  localTransactionCurrencyCode: string;
  minLocalTransactionAmount: number | null;
  maxLocalTransactionAmount: number | null;
  localTransactionFee: number;
  localTransactionFeeCurrencyCode: string;
}

export interface ReloadlyBillPayResponse {
  id: number; // transactionId
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  referenceId: string | null;
  billerName: string;
  amount: number;
  currencyCode: string;
  date: string;
  code: string | null;
  pin: string | null;
}

@Injectable()
export class ReloadlyUtilitiesApiService {
  private readonly logger = new Logger(ReloadlyUtilitiesApiService.name);
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isReloadlyConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Reloadly Utilities API is not configured');
    }
  }

  private getBaseUrl(): string {
    return isReloadlySandbox()
      ? 'https://utilities-sandbox.reloadly.com'
      : 'https://utilities.reloadly.com';
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
      this.logger.error(`Reloadly Utilities auth failed (${response.status}): ${errorText}`);
      throw new BadRequestException(
        `Failed to authenticate with Reloadly Utilities (${response.status})`,
      );
    }

    const payload = (await response.json()) as ReloadlyTokenResponse;
    const token = payload.access_token;
    if (!token) {
      throw new BadRequestException(
        'Failed to authenticate with Reloadly Utilities: missing access token',
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
        Accept: 'application/com.reloadly.utilities-v1+json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, options);
    const responseText = await response.text();

    if (!response.ok) {
      let message = `Reloadly Utilities request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as { message?: string; errorCode?: string };
        if (errorPayload?.message) {
          message = errorPayload.message;
        }
      } catch {}
      this.logger.error(`Reloadly Utilities ${method} ${path} failed: ${message}`);
      throw new BadRequestException(`Reloadly Utilities error: ${message}`);
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Reloadly Utilities error: invalid JSON response');
    }
  }

  async listBillers(params?: {
    countryISOCode?: string;
    category?: string;
  }): Promise<ReloadlyBiller[]> {
    let path = '/billers';
    const queryParts: string[] = [];
    if (params?.countryISOCode) {
      queryParts.push(`countryISOCode=${params.countryISOCode.toUpperCase()}`);
    }
    if (params?.category) {
      queryParts.push(`category=${params.category}`);
    }
    if (queryParts.length > 0) {
      path += `?${queryParts.join('&')}`;
    }

    // In reloadly, sometimes the billers list is returned inside a paginated object or as a direct array.
    // Let's handle both.
    const response = await this.request<ReloadlyBiller[] | { content: ReloadlyBiller[] }>(
      'GET',
      path,
    );
    if (response && Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.content)) {
      return response.content;
    }
    return [];
  }

  async payBill(params: {
    subscriberAccountNumber: string;
    amount: number;
    billerId: number;
    useLocalAmount?: boolean;
    referenceId?: string;
    additionalInfo?: Record<string, unknown>;
  }): Promise<ReloadlyBillPayResponse> {
    return this.request<ReloadlyBillPayResponse>('POST', '/pay', {
      subscriberAccountNumber: params.subscriberAccountNumber,
      amount: params.amount,
      billerId: params.billerId,
      useLocalAmount: params.useLocalAmount ?? false,
      referenceId: params.referenceId,
      additionalInfo: params.additionalInfo,
    });
  }
}
