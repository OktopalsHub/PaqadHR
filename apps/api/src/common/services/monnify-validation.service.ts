import { BadRequestException, GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';
import { getMonnifyBaseUrl, isMonnifyConfigured } from '../config/monnify.config';
import { MonnifyApiService } from './monnify-api.service';

export type MonnifyTelcoNetwork = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

interface MonnifyApiEnvelope<T> {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: T;
}

export interface MonnifyBiller {
  billerCode?: string;
  code?: string;
  name?: string;
  categoryCode?: string;
}

export interface MonnifyBillerCategory {
  categoryCode?: string;
  categoryName?: string;
}

export interface MonnifyProduct {
  productCode?: string;
  code?: string;
  name?: string;
  amount?: number | string;
  minAmount?: number | string;
  maxAmount?: number | string;
  price?: number | string;
  category?: { code?: string };
}

export interface MonnifyValidateBody {
  customerName?: string;
  validationReference?: string;
  requireValidationRef?: boolean;
  vendInstruction?: {
    requireValidationRef?: boolean;
    validationReference?: string;
  };
}

export interface MonnifyVendBody {
  transactionReference?: string;
  vendReference?: string;
  vendStatus?: string;
  status?: string;
}

@Injectable()
export class MonnifyValidationService {
  private readonly logger = new Logger(MonnifyValidationService.name);
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly REQUEST_TIMEOUT_MS = 10 * 1000;
  static VEND_POLL_ATTEMPTS = 3;
  static VEND_POLL_DELAY_MS = 2000;
  private readonly billerCache = new Map<string, { expiresAt: number; billers: MonnifyBiller[] }>();
  private readonly productCache = new Map<
    string,
    { expiresAt: number; products: MonnifyProduct[] }
  >();

  constructor(private readonly monnifyApi: MonnifyApiService) {}

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Monnify billing api is not configured');
    }
  }

  networkMatchers(network: MonnifyTelcoNetwork): string[] {
    switch (network) {
      case 'MTN':
        return ['mtn'];
      case 'AIRTEL':
        return ['airtel'];
      case 'GLO':
        return ['glo'];
      case '9MOBILE':
        return ['9mobile', '9 mobile', 'etisalat', 't2'];
      default:
        return [String(network).toLowerCase()];
    }
  }

  matchesNetwork(name: string | undefined, network: MonnifyTelcoNetwork): boolean {
    const haystack = (name ?? '').toLowerCase();
    return this.networkMatchers(network).some((needle) => haystack.includes(needle));
  }

  async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(MonnifyValidationService.REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : undefined;
      if (name === 'AbortError' || name === 'TimeoutError') {
        const path = new URL(url).pathname;
        this.logger.warn(`Monnify billing request timed out: ${init.method ?? 'GET'} ${path}`);
        throw new GatewayTimeoutException('Monnify billing service timed out. Please try again.');
      }
      throw error;
    }
  }

  billerId(biller: MonnifyBiller): string | undefined {
    return biller.code ?? biller.billerCode;
  }

  productId(product: MonnifyProduct): string | undefined {
    return product.code ?? product.productCode;
  }

  describeBillers(billers: MonnifyBiller[], limit = 10): string {
    if (billers.length === 0) return 'biller list was empty';
    return `returned: ${billers
      .slice(0, limit)
      .map((biller) => `${this.billerId(biller) ?? '?'} (${biller.name ?? '?'})`)
      .join(', ')}`;
  }

  async requestGet<T>(path: string, query?: Record<string, string>): Promise<T> {
    this.ensureConfigured();
    const token = await this.monnifyApi.getAccessToken();
    const url = new URL(`${getMonnifyBaseUrl()}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) url.searchParams.set(key, value);
      }
    }

    const response = await this.fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as MonnifyApiEnvelope<T>;
    if (!response.ok || payload.requestSuccessful === false) {
      const message = payload.responseMessage || `Monnify billing GET failed (${response.status})`;
      this.logger.error(`Monnify billing GET ${path} failed: ${message}`);
      throw new BadRequestException(`Monnify billing error: ${message}`);
    }
    return (payload.responseBody ?? ({} as T)) as T;
  }

  async requestPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    this.ensureConfigured();
    const token = await this.monnifyApi.getAccessToken();
    const response = await this.fetchWithTimeout(`${getMonnifyBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as MonnifyApiEnvelope<T>;
    if (!response.ok || payload.requestSuccessful === false) {
      const message = payload.responseMessage || `Monnify billing POST failed (${response.status})`;
      this.logger.error(`Monnify billing POST ${path} failed: ${message}`);
      throw new BadRequestException(`Monnify billing error: ${message}`);
    }
    return (payload.responseBody ?? ({} as T)) as T;
  }

  async listBillers(categoryCode: string): Promise<MonnifyBiller[]> {
    const cached = this.billerCache.get(categoryCode);
    if (cached && cached.expiresAt > Date.now()) return cached.billers;
    const body = await this.requestGet<MonnifyBiller[] | { content?: MonnifyBiller[] }>(
      '/api/v1/vas/bills-payment/billers',
      { category_code: categoryCode, size: '100', page: '0' },
    );
    const billers = Array.isArray(body) ? body : (body.content ?? []);
    this.billerCache.set(categoryCode, {
      billers,
      expiresAt: Date.now() + MonnifyValidationService.CACHE_TTL_MS,
    });
    return billers;
  }

  async listBillerCategories(): Promise<MonnifyBillerCategory[]> {
    const body = await this.requestGet<
      MonnifyBillerCategory[] | { content?: MonnifyBillerCategory[] }
    >('/api/v1/vas/bills-payment/biller-categories', { size: '100', page: '0' });
    const categories = Array.isArray(body) ? body : (body.content ?? []);
    this.logger.log(`Fetched ${categories.length} biller categories from Monnify`);
    return categories;
  }

  async listProducts(billerCode: string): Promise<MonnifyProduct[]> {
    const cached = this.productCache.get(billerCode);
    if (cached && cached.expiresAt > Date.now()) return cached.products;
    const body = await this.requestGet<MonnifyProduct[] | { content?: MonnifyProduct[] }>(
      '/api/v1/vas/bills-payment/biller-products',
      { biller_code: billerCode, size: '100', page: '0' },
    );
    const products = Array.isArray(body) ? body : (body.content ?? []);
    this.productCache.set(billerCode, {
      products,
      expiresAt: Date.now() + MonnifyValidationService.CACHE_TTL_MS,
    });
    return products;
  }

  productAmount(product: MonnifyProduct): number | null {
    const raw = product.price ?? product.amount ?? product.minAmount;
    if (raw == null) return null;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : null;
  }

  async validateCustomer(
    productCode: string,
    customerId: string,
  ): Promise<{ validationReference?: string; requireValidationRef: boolean }> {
    this.logger.log(
      `Validating customer with productCode: ${productCode}, customerId: ${customerId}`,
    );
    const body = await this.requestPost<MonnifyValidateBody>(
      '/api/v1/vas/bills-payment/validate-customer',
      { productCode, customerId },
    );
    const requireValidationRef = Boolean(
      body.requireValidationRef ?? body.vendInstruction?.requireValidationRef,
    );
    const validationReference =
      body.validationReference ?? body.vendInstruction?.validationReference;
    return { requireValidationRef, validationReference };
  }

  async requeryVend(vendReference: string): Promise<MonnifyVendBody> {
    return this.requestGet<MonnifyVendBody>('/api/v1/vas/bills-payment/requery', {
      reference: vendReference,
    });
  }

  async vend(input: {
    productCode: string;
    customerId: string;
    vendAmount: number;
    vendReference: string;
    validationReference?: string;
  }): Promise<{ success: boolean; transactionId: string | null; status: string }> {
    const body: Record<string, unknown> = {
      productCode: input.productCode,
      customerId: input.customerId,
      vendAmount: input.vendAmount,
      vendReference: input.vendReference,
    };
    if (input.validationReference) {
      body.validationReference = input.validationReference;
    }

    let result = await this.requestPost<MonnifyVendBody>('/api/v1/vas/bills-payment/vend', body);
    const pendingStatuses = ['IN_PROGRESS', 'PROCESSING', 'PENDING'];
    const isTerminal = (value: MonnifyVendBody): string => {
      const status = (value.vendStatus ?? value.status ?? '').toUpperCase();
      if (!status || pendingStatuses.includes(status)) return 'PENDING';
      return status;
    };
    for (let attempt = 0; attempt < MonnifyValidationService.VEND_POLL_ATTEMPTS; attempt++) {
      if (isTerminal(result) !== 'PENDING') break;
      await new Promise((resolve) =>
        setTimeout(resolve, MonnifyValidationService.VEND_POLL_DELAY_MS),
      );
      try {
        result = await this.requeryVend(input.vendReference);
      } catch {
        this.logger.warn('Monnify billing requery failed');
      }
    }
    const status = isTerminal(result);
    const success = status === 'SUCCESS' || status === 'COMPLETED' || status === 'SUCCESSFUL';
    return {
      success,
      transactionId:
        result.transactionReference ??
        result.vendReference ??
        (success ? input.vendReference : null),
      status,
    };
  }
}
