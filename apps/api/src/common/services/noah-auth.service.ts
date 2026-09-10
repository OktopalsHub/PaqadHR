import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getNoahApiKey,
  getNoahBaseUrl,
  getNoahEnvironment,
  getNoahSigningPrivateKey,
  isNoahConfigured,
  isNoahSigningRequired,
} from '../config/noah.config';
import { formatNoahHttpError } from '../config/noah-api.util';
import { createNoahApiSignature, noahJwtPath } from '../config/noah-request-sign.util';

const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class NoahAuthService {
  private readonly logger = new Logger(NoahAuthService.name);

  isConfigured(): boolean {
    return isNoahConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Noah is not configured');
    }
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<T> {
    this.ensureConfigured();

    const base = getNoahBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) url.searchParams.set(key, value);
      }
    }

    const bodyBuffer =
      body && (method === 'POST' || method === 'PUT')
        ? Buffer.from(JSON.stringify(body))
        : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': getNoahApiKey(),
    };

    if (method === 'POST' || method === 'PUT') {
      headers['X-Idempotency-Key'] = idempotencyKey ?? crypto.randomUUID();
    }

    const signingKey = getNoahSigningPrivateKey();
    if (isNoahSigningRequired() && signingKey) {
      const jwtPath = noahJwtPath(normalizedPath, base);
      const queryParams =
        query && Object.keys(query).length > 0
          ? Object.fromEntries(
              Object.entries(query).filter(([, value]) => value) as [string, string][],
            )
          : undefined;
      headers['Api-Signature'] = createNoahApiSignature({
        method,
        path: jwtPath,
        privateKey: signingKey,
        body: bodyBuffer,
        queryParams,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyBuffer,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`Noah ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
        throw new BadRequestException('Noah request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = (await response.json().catch(() => ({}))) as T & {
      message?: string;
      error?: string;
      status?: string;
    };

    if (!response.ok) {
      const message =
        (typeof payload === 'object' && payload && 'message' in payload
          ? String(payload.message)
          : undefined) ||
        (typeof payload === 'object' && payload && 'error' in payload
          ? String(payload.error)
          : undefined) ||
        `Noah request failed (${response.status})`;
      this.logger.error(
        `Noah ${method} ${path} failed: ${message} (env=${getNoahEnvironment()}, host=${url.host})`,
      );
      throw new BadRequestException(formatNoahHttpError(response.status, message));
    }

    return payload;
  }
}
