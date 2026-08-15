import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getTremendousApiKey,
  getTremendousBaseUrl,
  getTremendousFundingSourceId,
  isTremendousConfigured,
} from '../config/tremendous.config';

export interface TremendousProductSku {
  min: number;
  max: number;
}

export interface TremendousProduct {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  currency_codes?: string[];
  countries?: Array<{ abbr?: string }>;
  skus?: TremendousProductSku[];
  images?: Array<{ src?: string; type?: string }>;
}

export interface TremendousOrderResponse {
  order?: {
    id?: string;
    status?: string;
    rewards?: Array<{
      id?: string;
      delivery?: { link?: string; status?: string };
    }>;
  };
  reward?: {
    id?: string;
    delivery?: { link?: string; status?: string };
  };
}

export interface TremendousCreateOrderParams {
  productId: string;
  denomination: number;
  currencyCode: string;
  recipientName: string;
  recipientEmail: string;
  externalId: string;
}

@Injectable()
export class TremendousApiService {
  private readonly logger = new Logger(TremendousApiService.name);

  isConfigured(): boolean {
    return isTremendousConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Tremendous gift card API is not configured');
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    this.ensureConfigured();
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${getTremendousApiKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${getTremendousBaseUrl()}${path}`, options);
    const responseText = await response.text();

    if (!response.ok) {
      let message = `Tremendous request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as {
          message?: string;
          error?: string | { message?: string };
          errors?: Array<{ message?: string }>;
        };
        const nested =
          errorPayload.errors?.[0]?.message ||
          (typeof errorPayload.error === 'string'
            ? errorPayload.error
            : errorPayload.error?.message) ||
          errorPayload.message;
        if (nested) {
          message = nested;
        }
      } catch {}
      this.logger.error(`Tremendous ${method} ${path} failed: ${message}`);
      throw new BadRequestException(`Tremendous error: ${message}`);
    }

    if (!responseText) {
      return {} as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Tremendous error: invalid JSON response');
    }
  }

  async listProducts(countryCodes?: string[]): Promise<TremendousProduct[]> {
    const codes = (countryCodes ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean);
    const query = codes.length > 0 ? `?country=${encodeURIComponent(codes.join(','))}` : '';
    const response = await this.request<{ products?: TremendousProduct[] }>(
      'GET',
      `/products${query}`,
    );
    return response.products ?? [];
  }

  async createOrder(params: TremendousCreateOrderParams): Promise<TremendousOrderResponse> {
    return this.request<TremendousOrderResponse>('POST', '/orders', {
      external_id: params.externalId,
      payment: {
        funding_source_id: getTremendousFundingSourceId(),
      },
      reward: {
        products: [params.productId],
        value: {
          denomination: params.denomination,
          currency_code: params.currencyCode,
        },
        delivery: {
          method: 'LINK',
        },
        recipient: {
          name: params.recipientName,
          email: params.recipientEmail,
        },
      },
    });
  }
}
