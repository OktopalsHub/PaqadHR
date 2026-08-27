import { BadRequestException, GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';
import { getMonnifyBaseUrl, isMonnifyConfigured } from '../config/monnify.config';
import { MonnifyApiService } from './monnify-api.service';

export type MonnifyTelcoNetwork = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

export interface MonnifyAirtimeInput {
  amount: number;
  phoneNumber: string;
  network: MonnifyTelcoNetwork;
  merchantTxRef: string;
  /** Provider product code for a user-selected data bundle (avoids price collisions). */
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
  // Sandbox VAS API returns { code, name }; older docs mention billerCode.
  billerCode?: string;
  code?: string;
  name?: string;
  categoryCode?: string;
}

interface MonnifyBillerCategory {
  categoryCode?: string;
  categoryName?: string;
}

interface MonnifyProduct {
  productCode?: string;
  code?: string;
  name?: string;
  amount?: number | string;
  minAmount?: number | string;
  maxAmount?: number | string;
  price?: number | string;
  category?: { code?: string };
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
  // Overridable in tests to avoid real sleeps while polling vend status.
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

  private async findAirtimeCategory(): Promise<string> {
    const categories = await this.listBillerCategories();
    const airtimeCategory = categories.find(
      (cat) =>
        (cat.categoryName?.toLowerCase().includes('airtime') ||
          cat.categoryCode?.toLowerCase().includes('airtime')) ??
        false,
    );
    if (!airtimeCategory?.categoryCode) {
      this.logger.error(
        `No airtime category found. Available categories: ${categories
          .map((c) => `${c.categoryName} (${c.categoryCode})`)
          .join(', ')}`,
      );
      throw new BadRequestException('Monnify billing error: no airtime category found');
    }
    this.logger.log(
      `Found airtime category: ${airtimeCategory.categoryName} (${airtimeCategory.categoryCode})`,
    );
    return airtimeCategory.categoryCode;
  }

  private async findDataBundleCategory(): Promise<string> {
    const categories = await this.listBillerCategories();
    const dataCategory = categories.find(
      (cat) =>
        cat.categoryCode?.toUpperCase() === 'DATA_BUNDLE' ||
        cat.categoryName?.toLowerCase().includes('data bundle') ||
        false,
    );
    if (!dataCategory?.categoryCode) {
      throw new BadRequestException('Monnify billing error: no data bundle category found');
    }
    this.logger.log(
      `Found data category: ${dataCategory.categoryName} (${dataCategory.categoryCode})`,
    );
    return dataCategory.categoryCode;
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

  private billerId(biller: MonnifyBiller): string | undefined {
    return biller.code ?? biller.billerCode;
  }

  private productId(product: MonnifyProduct): string | undefined {
    return product.code ?? product.productCode;
  }

  private describeBillers(billers: MonnifyBiller[], limit = 10): string {
    if (billers.length === 0) return 'biller list was empty';
    return `returned: ${billers
      .slice(0, limit)
      .map((biller) => `${this.billerId(biller) ?? '?'} (${biller.name ?? '?'})`)
      .join(', ')}`;
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
    this.logger.log(
      `Fetched ${billers.length} billers for category ${categoryCode}: ${billers
        .map((b) => `${b.name} (${b.billerCode})`)
        .join(', ')}`,
    );
    this.billerCache.set(categoryCode, {
      billers,
      expiresAt: Date.now() + MonnifyBillApiService.CACHE_TTL_MS,
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
    this.logger.log(
      `Fetched ${products.length} products for biller ${billerCode}: ${products
        .map((p) => `${p.name} (${p.productCode})`)
        .join(', ')}`,
    );
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
    const actualCategoryCode =
      categoryCode === 'AIRTIME'
        ? await this.findAirtimeCategory()
        : await this.findDataBundleCategory();
    const billers = await this.listBillers(actualCategoryCode);
    this.logger.log(
      `Looking for ${network} biller in ${actualCategoryCode}. Available billers: ${billers
        .map((b) => `${b.name} (${b.billerCode})`)
        .join(', ')}`,
    );
    const match = billers.find((biller) => this.matchesNetwork(biller.name, network));
    if (!match || !this.billerId(match)) {
      this.logger.error(
        `No biller found for network ${network} in category ${actualCategoryCode}. Available billers: ${billers
          .map((b) => `${b.name} (${b.billerCode})`)
          .join(', ')}`,
      );
      throw new BadRequestException(
        `Monnify billing error: no ${categoryCode.toLowerCase()} biller for ${network} (${this.describeBillers(billers)})`,
      );
    }
    this.logger.log(`Found matching biller: ${match.name} (${match.billerCode})`);
    return match;
  }

  private productAmount(product: MonnifyProduct): number | null {
    const raw = product.price ?? product.amount ?? product.minAmount;
    if (raw == null) return null;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : null;
  }

  private async resolveAirtimeProduct(network: MonnifyTelcoNetwork): Promise<MonnifyProduct> {
    const biller = await this.resolveBiller('AIRTIME', network);
    const products = await this.listProducts(this.billerId(biller)!);
    const isAirtimeCategory = (row: MonnifyProduct): boolean =>
      (row.category?.code ?? '').toUpperCase() === 'AIRTIME';
    const product =
      products.find(
        (row) =>
          this.productId(row) && isAirtimeCategory(row) && /airtime|top.?up/i.test(row.name ?? ''),
      ) ??
      products.find((row) => this.productId(row) && isAirtimeCategory(row)) ??
      products.find((row) => this.productId(row)) ??
      null;
    if (!product || !this.productId(product)) {
      throw new BadRequestException(`Monnify billing error: no airtime product for ${network}`);
    }
    return product;
  }

  private async resolveDataProduct(
    network: MonnifyTelcoNetwork,
    amount: number,
    dataPlanCode?: string,
  ): Promise<MonnifyProduct> {
    // Telco data bundles live under DATA_BUNDLE; DATA only lists ISPs
    // (Spectranet, Smile, Swift).
    const biller = await this.resolveBiller('DATA_BUNDLE', network);
    const products = await this.listProducts(this.billerId(biller)!);
    const candidates = products.filter((row) => this.productId(row));
    // A provided code is authoritative: never substitute another plan at the
    // same price when a selected bundle was removed or changed by Monnify.
    const product = dataPlanCode
      ? candidates.find((row) => this.productId(row) === dataPlanCode)
      : (candidates.find((row) => this.productAmount(row) === amount) ??
        candidates.find((row) => this.productId(row) === String(amount)));
    if (!product || !this.productId(product)) {
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
    const products = await this.listProducts(this.billerId(biller)!);
    return products
      .map((row) => {
        const amount = this.productAmount(row);
        const id = this.productId(row);
        if (amount == null || !id) return null;
        return {
          amount,
          plan: row.name || id,
          productCode: id,
        };
      })
      .filter((row): row is MonnifyDataPlan => row != null);
  }

  private async validateCustomer(
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

  private async requeryVend(vendReference: string): Promise<MonnifyVendBody> {
    return this.requestGet<MonnifyVendBody>('/api/v1/vas/bills-payment/requery', {
      reference: vendReference,
    });
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

    let result = await this.requestPost<MonnifyVendBody>('/api/v1/vas/bills-payment/vend', body);
    const pendingStatuses = ['IN_PROGRESS', 'PROCESSING', 'PENDING'];
    const isTerminal = (value: MonnifyVendBody): string => {
      const status = (value.vendStatus ?? value.status ?? '').toUpperCase();
      // Normalize a never-settled vend so callers can branch on PENDING.
      if (!status || pendingStatuses.includes(status)) return 'PENDING';
      return status;
    };
    for (let attempt = 0; attempt < MonnifyBillApiService.VEND_POLL_ATTEMPTS; attempt++) {
      if (isTerminal(result) !== 'PENDING') break;
      await new Promise((resolve) => setTimeout(resolve, MonnifyBillApiService.VEND_POLL_DELAY_MS));
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

  private normalizePhoneNumber(phoneNumber: string): string {
    let normalized = phoneNumber.replace(/\s+/g, '').replace(/[-()]/g, '');

    // If starts with +234, remove the + and keep 234
    if (normalized.startsWith('+234')) {
      normalized = normalized.replace('+234', '234');
    }
    // If starts with 0, replace with 234 (Nigeria country code)
    else if (normalized.startsWith('0')) {
      normalized = `234${normalized.substring(1)}`;
    }
    // If doesn't start with 234, assume it needs country code
    else if (!normalized.startsWith('234')) {
      normalized = `234${normalized}`;
    }

    return normalized;
  }

  private async purchase(
    product: MonnifyProduct,
    input: MonnifyAirtimeInput,
  ): Promise<{ success: boolean; transactionId: string | null; status: string }> {
    const customerId = this.normalizePhoneNumber(input.phoneNumber);
    const id = this.productId(product)!;
    const validation = await this.validateCustomer(id, customerId);
    return this.vend({
      productCode: id,
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
    const categories = await this.listBillerCategories();
    const electricityCategory = categories.find(
      (cat) =>
        (cat.categoryName?.toLowerCase().includes('electricity') ||
          cat.categoryCode?.toLowerCase().includes('electricity')) ??
        false,
    );
    if (!electricityCategory?.categoryCode) {
      this.logger.error(
        `No electricity category found. Available categories: ${categories
          .map((c) => `${c.categoryName} (${c.categoryCode})`)
          .join(', ')}`,
      );
      return [];
    }
    const billers = await this.listBillers(electricityCategory.categoryCode);
    return billers
      .map((biller) => ({ biller, id: this.billerId(biller) }))
      .filter((row): row is { biller: MonnifyBiller; id: string } => Boolean(row.id))
      .map((row) => ({
        id: row.id,
        name: row.biller.name || row.id,
      }));
  }

  private async resolveElectricityProduct(
    billerCode: string,
    serviceType: 'PREPAID' | 'POSTPAID',
  ): Promise<MonnifyProduct> {
    const products = await this.listProducts(billerCode);
    const needle = serviceType.toLowerCase();
    const product =
      products.find(
        (row) => this.productId(row) && (row.name ?? '').toLowerCase().includes(needle),
      ) ??
      products.find((row) => this.productId(row)) ??
      null;
    if (!product || !this.productId(product)) {
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
      { productCode: this.productId(product), customerId },
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
    const id = this.productId(product)!;
    const validation = await this.validateCustomer(id, customerId);
    const result = await this.vend({
      productCode: id,
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
