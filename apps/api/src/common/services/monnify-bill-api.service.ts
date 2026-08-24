import { BadRequestException, GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';
import { getMonnifyBaseUrl, isMonnifyConfigured } from '../config/monnify.config';
import { MonnifyApiService } from './monnify-api.service';

export type MonnifyTelcoNetwork = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

export interface MonnifyAirtimeInput {
  amount: number;
  phoneNumber: string;
  network: MonnifyTelcoNetwork;
  merchantTxRef: string;
  dataPlanCode?: string;
}

export interface MonnifyDataPlan {
  amount: number;
  plan: string;
  productCode: string;
}

interface MonnifyApiEnvelope<T> {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: T;
}

interface MonnifyBiller {
  billerCode?: string;
  name?: string;
  categoryCode?: string;
}

interface MonnifyProduct {
  productCode?: string;
  name?: string;
  amount?: number | string;
  minAmount?: number | string;
  maxAmount?: number | string;
}

interface MonnifyValidateBody {
  customerName?: string;
  validationReference?: string;
  requireValidationRef?: boolean;
  vendInstruction?: {
    requireValidationRef?: boolean;
    validationReference?: string;
  };
}

interface MonnifyVendBody {
  transactionReference?: string;
  vendReference?: string;
  vendStatus?: string;
  status?: string;
}

@Injectable()
export class MonnifyBillApiService {
  private readonly logger = new Logger(MonnifyBillApiService.name);
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly REQUEST_TIMEOUT_MS = 10 * 1000;
  private readonly billerCache = new Map<string, { expiresAt: number; billers: MonnifyBiller[] }>();
  private readonly productCache = new Map<
    string,
    { expiresAt: number; products: MonnifyProduct[] }
  >();

  constructor(private readonly monnifyApi: MonnifyApiService) {}

  isConfigured(): boolean {
    return isMonnifyConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Monnify billing api is not configured');
    }
  }

  private networkMatchers(network: MonnifyTelcoNetwork): string[] {
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

  private matchesNetwork(name: string | undefined, network: MonnifyTelcoNetwork): boolean {
    const haystack = (name ?? '').toLowerCase();
    return this.networkMatchers(network).some((needle) => haystack.includes(needle));
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(MonnifyBillApiService.REQUEST_TIMEOUT_MS),
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

  private async requestGet<T>(path: string, query?: Record<string, string>): Promise<T> {
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

  private async requestPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
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

  private async listBillers(categoryCode: string): Promise<MonnifyBiller[]> {
    const cached = this.billerCache.get(categoryCode);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.billers;
    }

    const body = await this.requestGet<MonnifyBiller[] | { content?: MonnifyBiller[] }>(
      '/api/v1/vas/bills-payment/billers',
      { category_code: categoryCode, size: '100', page: '0' },
    );
    const billers = Array.isArray(body) ? body : (body.content ?? []);
    this.billerCache.set(categoryCode, {
      billers,
      expiresAt: Date.now() + MonnifyBillApiService.CACHE_TTL_MS,
    });
    return billers;
  }

  private async listProducts(billerCode: string): Promise<MonnifyProduct[]> {
    const cached = this.productCache.get(billerCode);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.products;
    }

    const body = await this.requestGet<MonnifyProduct[] | { content?: MonnifyProduct[] }>(
      '/api/v1/vas/bills-payment/biller-products',
      { biller_code: billerCode, size: '100', page: '0' },
    );
    const products = Array.isArray(body) ? body : (body.content ?? []);
    this.productCache.set(billerCode, {
      products,
      expiresAt: Date.now() + MonnifyBillApiService.CACHE_TTL_MS,
    });
    return products;
  }

  private async resolveBiller(
    categoryCode: 'AIRTIME' | 'DATA_BUNDLE',
    network: MonnifyTelcoNetwork,
  ): Promise<MonnifyBiller> {
    const billers = await this.listBillers(categoryCode);
    const match = billers.find((biller) => this.matchesNetwork(biller.name, network));
    if (!match?.billerCode) {
      throw new BadRequestException(
        `Monnify billing error: no ${categoryCode.toLowerCase()} biller for ${network}`,
      );
    }
    return match;
  }

  private productAmount(product: MonnifyProduct): number | null {
    const raw = product.amount ?? product.minAmount;
    if (raw == null) return null;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : null;
  }

  private async resolveAirtimeProduct(network: MonnifyTelcoNetwork): Promise<MonnifyProduct> {
    const biller = await this.resolveBiller('AIRTIME', network);
    const products = await this.listProducts(biller.billerCode!);
    const product =
      products.find((row) => /airtime/i.test(row.name ?? '')) ??
      products.find((row) => row.productCode) ??
      null;
    if (!product?.productCode) {
      throw new BadRequestException(`Monnify billing error: no airtime product for ${network}`);
    }
    return product;
  }

  private async resolveDataProduct(
    network: MonnifyTelcoNetwork,
    amount: number,
    dataPlanCode?: string,
  ): Promise<MonnifyProduct> {
    const biller = await this.resolveBiller('DATA_BUNDLE', network);
    const products = await this.listProducts(biller.billerCode!);
    const product = dataPlanCode
      ? products.find((row) => row.productCode === dataPlanCode)
      : (products.find((row) => this.productAmount(row) === amount) ??
        products.find((row) => row.productCode === String(amount)));
    if (!product?.productCode) {
      throw new BadRequestException(
        dataPlanCode
          ? 'Monnify billing error: the selected data plan is no longer available'
          : `Monnify billing error: no data product for ${network} at amount ${amount}`,
      );
    }
    if (dataPlanCode && this.productAmount(product) !== amount) {
      throw new BadRequestException(
        'Monnify billing error: selected data plan amount does not match',
      );
    }
    return product;
  }

  async listDataPlans(telco: string): Promise<MonnifyDataPlan[]> {
    const network = telco.toUpperCase() as MonnifyTelcoNetwork;
    const biller = await this.resolveBiller('DATA_BUNDLE', network);
    const products = await this.listProducts(biller.billerCode!);
    return products
      .map((row) => {
        const amount = this.productAmount(row);
        if (amount == null || !row.productCode) return null;
        return {
          amount,
          plan: row.name || row.productCode,
          productCode: row.productCode,
        };
      })
      .filter((row): row is MonnifyDataPlan => row != null);
  }

  private async validateCustomer(
    productCode: string,
    customerId: string,
  ): Promise<{ validationReference?: string; requireValidationRef: boolean }> {
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

  private async vend(input: {
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

    const result = await this.requestPost<MonnifyVendBody>('/api/v1/vas/bills-payment/vend', body);
    const status = (result.vendStatus ?? result.status ?? 'UNKNOWN').toUpperCase();
    const success = status === 'SUCCESS' || status === 'COMPLETED' || status === 'SUCCESSFUL';
    return {
      success,
      transactionId: result.transactionReference ?? result.vendReference ?? input.vendReference,
      status,
    };
  }

  private async purchase(
    product: MonnifyProduct,
    input: MonnifyAirtimeInput,
  ): Promise<{ success: boolean; transactionId: string | null; status: string }> {
    const customerId = input.phoneNumber.replace(/\s+/g, '');
    const validation = await this.validateCustomer(product.productCode!, customerId);
    return this.vend({
      productCode: product.productCode!,
      customerId,
      vendAmount: input.amount,
      vendReference: input.merchantTxRef,
      validationReference: validation.requireValidationRef
        ? validation.validationReference
        : undefined,
    });
  }

  async purchaseAirtime(input: MonnifyAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    const product = await this.resolveAirtimeProduct(input.network);
    return this.purchase(product, input);
  }

  async purchaseDataBundle(input: MonnifyAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    const product = await this.resolveDataProduct(input.network, input.amount, input.dataPlanCode);
    return this.purchase(product, input);
  }

  async listElectricityBillers(): Promise<Array<{ id: string; name: string }>> {
    const billers = await this.listBillers('ELECTRICITY');
    return billers
      .filter((biller) => Boolean(biller.billerCode))
      .map((biller) => ({
        id: String(biller.billerCode),
        name: biller.name || String(biller.billerCode),
      }));
  }

  private async resolveElectricityProduct(
    billerCode: string,
    serviceType: 'PREPAID' | 'POSTPAID',
  ): Promise<MonnifyProduct> {
    const products = await this.listProducts(billerCode);
    const needle = serviceType.toLowerCase();
    const product =
      products.find((row) => (row.name ?? '').toLowerCase().includes(needle)) ??
      products.find((row) => row.productCode) ??
      null;
    if (!product?.productCode) {
      throw new BadRequestException(
        `Monnify billing error: no ${serviceType.toLowerCase()} electricity product for ${billerCode}`,
      );
    }
    return product;
  }

  async lookupElectricity(
    billerCode: string,
    meterNumber: string,
    serviceType: 'PREPAID' | 'POSTPAID' = 'PREPAID',
  ): Promise<{
    customerName: string | null;
    meterNumber: string | null;
    address: string | null;
    billerId: string | null;
  }> {
    const product = await this.resolveElectricityProduct(billerCode, serviceType);
    const customerId = meterNumber.replace(/\s+/g, '');
    const body = await this.requestPost<MonnifyValidateBody>(
      '/api/v1/vas/bills-payment/validate-customer',
      { productCode: product.productCode, customerId },
    );
    return {
      customerName: body.customerName ?? null,
      meterNumber: customerId,
      address: null,
      billerId: billerCode,
    };
  }

  async purchaseElectricity(input: {
    amount: number;
    meterNumber: string;
    billerId: string;
    serviceType: 'PREPAID' | 'POSTPAID';
    merchantTxRef: string;
  }): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
    token: string | null;
  }> {
    const product = await this.resolveElectricityProduct(input.billerId, input.serviceType);
    const customerId = input.meterNumber.replace(/\s+/g, '');
    const validation = await this.validateCustomer(product.productCode!, customerId);
    const result = await this.vend({
      productCode: product.productCode!,
      customerId,
      vendAmount: input.amount,
      vendReference: input.merchantTxRef,
      validationReference: validation.requireValidationRef
        ? validation.validationReference
        : undefined,
    });
    return { ...result, token: null };
  }
}
