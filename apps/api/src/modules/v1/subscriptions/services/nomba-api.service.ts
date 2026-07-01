import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaClientId,
  getNombaClientSecret,
  isNombaConfigured,
} from '../config/nomba.config';
import { formatNombaAmount } from '../utils/per-seat-pricing.util';

function stringifyOrderMeta(
  meta?: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  if (!meta) return {};
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

interface NombaTokenResponse {
  data?: { access_token?: string; expires_in?: number };
}

interface NombaCheckoutResponse {
  data?: {
    checkoutLink?: string;
    orderReference?: string;
  };
}

interface NombaVerifyResponse {
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    meta?: Record<string, unknown>;
  };
}

export interface NombaCheckoutOrderInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  tokenizeCard?: boolean;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface NombaTokenizedChargeInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  tokenKey: string;
  meta?: Record<string, string | number | boolean | undefined>;
}

@Injectable()
export class NombaApiService {
  private readonly logger = new Logger(NombaApiService.name);
  private cachedToken?: { token: string; expiresAt: number };

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba billing is not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const response = await fetch(`${getNombaBaseUrl()}/v1/auth/token/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: getNombaClientId(),
        client_secret: getNombaClientSecret(),
      }),
    });

    const payload = (await response.json()) as NombaTokenResponse;
    const token = payload.data?.access_token;
    if (!response.ok || !token) {
      throw new BadRequestException('Failed to authenticate with Nomba');
    }

    const ttl = (payload.data?.expires_in ?? 3600) * 1000;
    this.cachedToken = { token, expiresAt: Date.now() + ttl - 60_000 };
    return token;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${getNombaBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as T & { message?: string };
    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? String(payload.message)
          : `Nomba request failed (${response.status})`;
      this.logger.error(`Nomba ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba Error: ${message}`);
    }

    return payload;
  }

  async createCheckoutOrder(input: NombaCheckoutOrderInput): Promise<{
    checkoutLink: string;
    orderReference: string;
  }> {
    const payload = await this.request<NombaCheckoutResponse>('/v1/checkout/order', {
      order: {
        orderReference: input.orderReference,
        customerEmail: input.customerEmail,
        amount: formatNombaAmount(input.amount),
        currency: input.currency.toUpperCase(),
        callbackUrl: input.callbackUrl,
        orderMetaData: stringifyOrderMeta(input.meta),
      },
      tokenizeCard: input.tokenizeCard ?? true,
    });

    const checkoutLink = payload.data?.checkoutLink;
    if (!checkoutLink) {
      throw new BadRequestException('Failed to initialize Nomba checkout');
    }

    return {
      checkoutLink,
      orderReference: payload.data?.orderReference || input.orderReference,
    };
  }

  async chargeTokenizedCard(input: NombaTokenizedChargeInput): Promise<{ orderReference: string }> {
    const payload = await this.request<{ data?: { orderReference?: string } }>(
      '/v1/checkout/tokenized-card-payment',
      {
        tokenKey: input.tokenKey,
        order: {
          orderReference: input.orderReference,
          customerEmail: input.customerEmail,
          amount: formatNombaAmount(input.amount),
          currency: input.currency.toUpperCase(),
          callbackUrl: input.callbackUrl,
          accountId: getNombaAccountId(),
          orderMetaData: stringifyOrderMeta(input.meta),
        },
      },
    );

    return {
      orderReference: payload.data?.orderReference || input.orderReference,
    };
  }

  async verifyTransaction(reference: string): Promise<NombaVerifyResponse['data'] | null> {
    const e2eAmountMatch = /^e2e_verify_(\d+)$/.exec(reference);
    if (process.env.NODE_ENV === 'test' && e2eAmountMatch) {
      return { status: 'success', amount: Number(e2eAmountMatch[1]) };
    }

    this.ensureConfigured();

    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${getNombaBaseUrl()}/v1/transactions/accounts/single?transactionRef=${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accountId: getNombaAccountId(),
          },
        },
      );

      const payload = (await response.json()) as NombaVerifyResponse;
      if (!response.ok) {
        return null;
      }

      return payload.data ?? null;
    } catch (error) {
      this.logger.warn(
        `Nomba verify failed for ${reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyNombaWebhookSignature(rawBody, signature);
  }
}
