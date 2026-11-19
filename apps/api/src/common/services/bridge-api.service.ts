import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
  getBridgeApiKey,
  getBridgeBaseUrl,
  getBridgeRequestTimeoutMs,
} from '../config/bridge.config';
import { PaymentProviderError } from '../providers/payment-provider.interface';

export interface BridgeResource {
  id: string;
  [key: string]: unknown;
}

export interface BridgeExchangeRate {
  midmarket_rate: string;
  buy_rate: string;
  sell_rate: string;
  updated_at: string;
}

@Injectable()
export class BridgeApiService {
  async createKycLink(
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeResource> {
    return this.requestResource('POST', '/v0/kyc_links', payload, idempotencyKey);
  }

  async getCustomer(customerId: string): Promise<BridgeResource> {
    return this.requestResource('GET', `/v0/customers/${this.pathSegment(customerId)}`);
  }

  async getKycLink(kycLinkId: string): Promise<BridgeResource> {
    return this.requestResource('GET', `/v0/kyc_links/${this.pathSegment(kycLinkId)}`);
  }

  async createWallet(
    customerId: string,
    chain: string,
    idempotencyKey: string,
  ): Promise<BridgeResource> {
    return this.requestResource(
      'POST',
      `/v0/customers/${this.pathSegment(customerId)}/wallets`,
      { chain },
      idempotencyKey,
    );
  }

  async getWallet(customerId: string, walletId: string): Promise<BridgeResource> {
    return this.requestResource(
      'GET',
      `/v0/customers/${this.pathSegment(customerId)}/wallets/${this.pathSegment(walletId)}`,
    );
  }

  async createVirtualAccount(
    customerId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeResource> {
    return this.request(
      'POST',
      `/v0/customers/${this.pathSegment(customerId)}/virtual_accounts`,
      payload,
      idempotencyKey,
    );
  }

  async getVirtualAccount(customerId: string, virtualAccountId: string): Promise<BridgeResource> {
    return this.requestResource(
      'GET',
      `/v0/customers/${this.pathSegment(customerId)}/virtual_accounts/${this.pathSegment(virtualAccountId)}`,
    );
  }

  async createExternalAccount(
    customerId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeResource> {
    return this.requestResource(
      'POST',
      `/v0/customers/${this.pathSegment(customerId)}/external_accounts`,
      payload,
      idempotencyKey,
    );
  }

  async getExternalAccount(customerId: string, externalAccountId: string): Promise<BridgeResource> {
    return this.requestResource(
      'GET',
      `/v0/customers/${this.pathSegment(customerId)}/external_accounts/${this.pathSegment(externalAccountId)}`,
    );
  }

  async createTransfer(
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeResource> {
    return this.requestResource('POST', '/v0/transfers', payload, idempotencyKey);
  }

  async getTransfer(transferId: string): Promise<BridgeResource> {
    return this.requestResource('GET', `/v0/transfers/${this.pathSegment(transferId)}`);
  }

  async getExchangeRate(from: string, to: string): Promise<BridgeExchangeRate> {
    const query = new URLSearchParams({ from: from.toLowerCase(), to: to.toLowerCase() });
    const response = await this.request<BridgeExchangeRate>(
      'GET',
      `/v0/exchange_rates?${query.toString()}`,
    );
    if (
      !response ||
      !this.isPositiveDecimal(response.sell_rate) ||
      !this.isPositiveDecimal(response.midmarket_rate) ||
      !this.isPositiveDecimal(response.buy_rate) ||
      typeof response.updated_at !== 'string' ||
      Number.isNaN(Date.parse(response.updated_at))
    ) {
      throw new PaymentProviderError(
        'Bridge returned an invalid exchange rate.',
        'INVALID_RESPONSE',
      );
    }
    return response;
  }

  private async requestResource(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<BridgeResource> {
    return this.resource(await this.request(method, path, body, idempotencyKey));
  }

  private async request<T = BridgeResource>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const apiKey = getBridgeApiKey();
    if (!apiKey) throw new ServiceUnavailableException('Bridge payroll is not configured.');
    if (method === 'POST' && !idempotencyKey?.trim()) {
      throw new PaymentProviderError(
        'Bridge write request requires an idempotency key.',
        'IDEMPOTENCY_KEY_REQUIRED',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${getBridgeBaseUrl()}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Api-Key': apiKey,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(getBridgeRequestTimeoutMs()),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new PaymentProviderError(
        timedOut ? 'Bridge request timed out.' : 'Bridge request could not be completed.',
        timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
        true,
      );
    }

    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      throw new PaymentProviderError(
        `Bridge request failed with status ${response.status}.`,
        `HTTP_${response.status}`,
        retryable,
      );
    }
    return responseBody as T;
  }

  private resource(value: unknown): BridgeResource {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof (value as { id?: unknown }).id !== 'string'
    ) {
      throw new PaymentProviderError('Bridge returned an invalid resource.', 'INVALID_RESPONSE');
    }
    return value as BridgeResource;
  }

  private pathSegment(value: string): string {
    if (!value || value.length > 255)
      throw new PaymentProviderError('Bridge resource identifier is invalid.', 'INVALID_ID');
    return encodeURIComponent(value);
  }

  private isPositiveDecimal(value: unknown): value is string {
    return (
      typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number(value) > 0
    );
  }
}
