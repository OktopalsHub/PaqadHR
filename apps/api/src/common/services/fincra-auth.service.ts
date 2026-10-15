import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  getFincraApiKey,
  getFincraBaseUrl,
  getFincraBusinessId,
  getFincraPublicKey,
  mapFincraCountryToSourceCurrency,
} from '../config/fincra.config';

interface FincraApiResponse<T = unknown> {
  success?: boolean;
  status?: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: T;
}

export interface FincraHttpResult<T> {
  parsed: FincraApiResponse<T>;
  httpStatus: number;
}

@Injectable()
export class FincraAuthService {
  private readonly logger = new Logger(FincraAuthService.name);
  private static readonly REQUEST_TIMEOUT_MS = 90_000;
  private businessProfileCache: { id: string; country?: string } | null = null;

  fincraAuthRejectedMessage(): string {
    return 'Fincra rejected the API key — check FINCRA_API_KEY / FINCRA_PUBLIC_KEY and that FINCRA_LIVE matches sandbox vs live';
  }

  throwIfFincraUnauthorized(httpStatus: number, detail?: string): void {
    if (httpStatus === 401 || httpStatus === 403) {
      throw new BadGatewayException(this.fincraAuthRejectedMessage());
    }
    if (detail && /unauthorized|forbidden/i.test(detail)) {
      throw new BadGatewayException(this.fincraAuthRejectedMessage());
    }
  }

  async resolveBusinessId(): Promise<string> {
    const explicit = getFincraBusinessId();
    if (explicit) return explicit;
    return (await this.loadBusinessProfile()).id;
  }

  async resolvePayoutSourceCurrency(): Promise<string> {
    const explicit = process.env.FINCRA_PAYOUT_SOURCE_CURRENCY?.trim();
    if (explicit) return explicit.toUpperCase();
    const profile = await this.loadBusinessProfile();
    return mapFincraCountryToSourceCurrency(profile.country);
  }

  async loadBusinessProfile(): Promise<{ id: string; country?: string }> {
    if (this.businessProfileCache) return this.businessProfileCache;

    const apiKey = getFincraApiKey();
    if (!apiKey) throw new Error('Fincra API key is not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FincraAuthService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${getFincraBaseUrl()}/profile/business/me`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'api-key': apiKey },
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: FincraApiResponse<{ _id?: string; country?: string }> = {};
      try {
        parsed = text
          ? (JSON.parse(text) as FincraApiResponse<{ _id?: string; country?: string }>)
          : {};
      } catch {
        this.logger.warn('Fincra business profile non-JSON response');
      }

      if (!response.ok) {
        const detail = parsed.message ?? `HTTP ${response.status}`;
        this.throwIfFincraUnauthorized(response.status, detail);
        throw new Error(`Fincra business profile lookup failed: ${detail}`);
      }

      const id = parsed.data?._id?.trim();
      if (!id) {
        throw new Error(
          'Fincra business profile missing _id — set FINCRA_BUSINESS_ID if auto-resolve fails',
        );
      }

      this.businessProfileCache = { id, country: parsed.data?.country };
      return this.businessProfileCache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fincra business profile lookup error: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { usePublicKey?: boolean; includeBusinessId?: boolean },
  ): Promise<FincraHttpResult<T>> {
    const apiKey = getFincraApiKey();
    if (!apiKey) throw new Error('Fincra API key is not configured');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': apiKey,
    };
    if (options?.usePublicKey) {
      const publicKey = getFincraPublicKey();
      if (!publicKey) throw new Error('Fincra public key is not configured');
      headers['x-pub-key'] = publicKey;
    }

    const businessId =
      getFincraBusinessId() ||
      (options?.usePublicKey || options?.includeBusinessId
        ? await this.resolveBusinessId()
        : undefined);
    if (businessId && (options?.usePublicKey || options?.includeBusinessId)) {
      headers['x-business-id'] = businessId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FincraAuthService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${getFincraBaseUrl()}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: FincraApiResponse<T> = {};
      try {
        parsed = text ? (JSON.parse(text) as FincraApiResponse<T>) : {};
      } catch {
        this.logger.warn(`Fincra API non-JSON response for ${method} ${path}`);
      }

      if (!response.ok) {
        this.logger.warn(
          `Fincra API ${method} ${path} failed: ${response.status} ${parsed.message ?? text.slice(0, 200)}`,
        );
      }

      return { parsed, httpStatus: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fincra API ${method} ${path} error: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
