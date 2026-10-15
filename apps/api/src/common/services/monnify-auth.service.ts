import { Buffer } from 'node:buffer';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  getMonnifyApiKey,
  getMonnifyBaseUrl,
  getMonnifySecretKey,
  isMonnifyConfigured,
} from '../config/monnify.config';

interface MonnifyAuthResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    accessToken?: string;
    expiresIn?: number;
  };
}

@Injectable()
export class MonnifyAuthService {
  private readonly logger = new Logger(MonnifyAuthService.name);
  private cachedToken?: { token: string; expiresAt: number };
  private static readonly REQUEST_TIMEOUT_MS = 90_000;
  private static readonly CHECKOUT_UNAVAILABLE =
    'Checkout is temporarily unavailable. Please try again later or contact support.';

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException(MonnifyAuthService.CHECKOUT_UNAVAILABLE);
    }
  }

  private isFetchTimeout(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.includes('timeout'))
    );
  }

  logMonnifyResponse(
    operation: string,
    path: string,
    httpStatus: number,
    payload: {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseCode?: string;
    },
    extra?: Record<string, string | boolean | number | null | undefined>,
  ): void {
    const parts = [
      `Monnify ${operation} ${path}`,
      `http=${httpStatus}`,
      `requestSuccessful=${payload.requestSuccessful ?? 'unknown'}`,
      `responseCode=${payload.responseCode ?? 'none'}`,
      `responseMessage=${payload.responseMessage ?? 'none'}`,
    ];
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        parts.push(`${key}=${value ?? 'none'}`);
      }
    }
    this.logger.warn(parts.join(' '));
  }

  async monnifyFetch(url: string, init?: RequestInit): Promise<Response> {
    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(MonnifyAuthService.REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (this.isFetchTimeout(error)) {
        this.logger.error(`Payment provider request timed out (${path})`);
        throw new ServiceUnavailableException(MonnifyAuthService.CHECKOUT_UNAVAILABLE);
      }
      this.logger.error(
        `Payment provider request failed (${path}): ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException(MonnifyAuthService.CHECKOUT_UNAVAILABLE);
    }
  }

  stringifyMeta(meta?: Record<string, unknown>): Record<string, string> {
    if (!meta) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value == null) continue;
      out[key] = typeof value === 'string' ? value : String(value);
    }
    return out;
  }

  async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const auth = Buffer.from(`${getMonnifyApiKey()}:${getMonnifySecretKey()}`).toString('base64');
    const response = await this.monnifyFetch(`${getMonnifyBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json().catch(() => ({}))) as MonnifyAuthResponse;
    const token = payload.responseBody?.accessToken;
    if (!response.ok || payload.requestSuccessful === false || !token) {
      this.logMonnifyResponse('auth', '/api/v1/auth/login', response.status, payload);
      throw new BadRequestException(MonnifyAuthService.CHECKOUT_UNAVAILABLE);
    }

    const expiresInSeconds = Number(payload.responseBody?.expiresIn ?? 0);
    this.cachedToken = {
      token,
      expiresAt:
        Date.now() +
        (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
          ? Math.max(30, expiresInSeconds - 60) * 1000
          : 25 * 60 * 1000),
    };
    return token;
  }
}
