import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getReloadlyAuthUrl,
  getReloadlyBaseUrl,
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

export interface ReloadlyProduct {
  productId: number;
  productName: string;
  global: boolean;
  countryCode: string;
  denominationType: string;
  minRecipientDenomination: number | null;
  maxRecipientDenomination: number | null;
  fixedRecipientDenominations: number[];
  recipientCurrencyCode: string;
  senderCurrencyCode: string;
  logoUrls: string[];
  brand?: { brandId: number; brandName: string };
}

export interface ReloadlyOrderResponse {
  transactionId?: number;
  status?: string;
  recipientEmail?: string;
  customIdentifier?: string;
  product?: {
    productId?: number;
    productName?: string;
    countryCode?: string;
    brand?: { brandName?: string };
  };
  smsFee?: number;
  discount?: number;
  currencyCode?: string;
  fee?: number;
  totalFee?: number;
  recipientFee?: number;
  
  transactionCreatedTime?: string;
}

export interface ReloadlyRedemptionCode {
  cardNumber?: string;
  pinCode?: string;
}

@Injectable()
export class ReloadlyApiService {
  private readonly logger = new Logger(ReloadlyApiService.name);
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isReloadlyConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Reloadly gift card API is not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const audience = isReloadlySandbox()
      ? 'https://giftcards-sandbox.reloadly.com'
      : 'https://giftcards.reloadly.com';

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
      this.logger.error(`Reloadly auth failed (${response.status}): ${errorText}`);
      throw new BadRequestException(`Failed to authenticate with Reloadly (${response.status})`);
    }

    const payload = (await response.json()) as ReloadlyTokenResponse;
    const token = payload.access_token;
    if (!token) {
      throw new BadRequestException('Failed to authenticate with Reloadly: missing access token');
    }

    const ttl = (payload.expires_in ?? 5000) * 1000;
    this.cachedToken = { token, expiresAt: Date.now() + ttl - 60_000 };
    return token;
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    const baseUrl = getReloadlyBaseUrl();

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/com.reloadly.giftcards-v1+json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, options);
    const responseText = await response.text();

    if (!response.ok) {
      let message = `Reloadly request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as { message?: string; errorCode?: string };
        if (errorPayload?.message) {
          message = errorPayload.message;
        }
      } catch {
      }
      this.logger.error(`Reloadly ${method} ${path} failed: ${message}`);
      throw new BadRequestException(`Reloadly error: ${message}`);
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Reloadly error: invalid JSON response');
    }
  }

  
  async listProducts(countryCode: string): Promise<ReloadlyProduct[]> {
    const response = await this.request<ReloadlyProduct[]>(
      'GET',
      `/countries/${countryCode.toUpperCase()}/products`,
    );
    return response ?? [];
  }

  
  async listProductsByCountries(countryCodes: string[]): Promise<ReloadlyProduct[]> {
    if (countryCodes.length === 0) return [];

    const results = await Promise.allSettled(
      countryCodes.map((code) => this.listProducts(code)),
    );

    const products: ReloadlyProduct[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        products.push(...result.value);
      }
    }
    return products;
  }

  
  async listCountries(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const response = await this.request<any[]>('GET', '/countries');
      return response ?? [];
    } catch (error) {
      this.logger.error(`Failed to fetch countries from Reloadly: ${error}`);
      return [];
    }
  }

  
  async orderGiftCard(params: {
    productId: number;
    quantity: number;
    unitPrice: number;
    customIdentifier: string;
    recipientEmail?: string;
    senderName?: string;
  }): Promise<ReloadlyOrderResponse> {
    return this.request<ReloadlyOrderResponse>('POST', '/orders', {
      productId: params.productId,
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      customIdentifier: params.customIdentifier,
      recipientEmail: params.recipientEmail,
      senderName: params.senderName ?? 'Paqad HR',
    });
  }

  
  async getRedemptionCodes(transactionId: number): Promise<ReloadlyRedemptionCode[]> {
    return this.request<ReloadlyRedemptionCode[]>(
      'GET',
      `/orders/transactions/${transactionId}/cards`,
    );
  }
}
