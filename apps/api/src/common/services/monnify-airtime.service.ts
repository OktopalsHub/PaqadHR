import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { MonnifyBiller, MonnifyProduct } from './monnify-validation.service';
import { MonnifyValidationService } from './monnify-validation.service';

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

export type MonnifyTelcoNetwork = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

@Injectable()
export class MonnifyAirtimeService {
  private readonly logger = new Logger(MonnifyAirtimeService.name);

  constructor(private readonly validation: MonnifyValidationService) {}

  private async findAirtimeCategory(): Promise<string> {
    const categories = await this.validation.listBillerCategories();
    const airtimeCategory = categories.find(
      (cat) =>
        (cat.categoryName?.toLowerCase().includes('airtime') ||
          cat.categoryCode?.toLowerCase().includes('airtime')) ??
        false,
    );
    if (!airtimeCategory?.categoryCode) {
      throw new BadRequestException('Monnify billing error: no airtime category found');
    }
    return airtimeCategory.categoryCode;
  }

  private async findDataBundleCategory(): Promise<string> {
    const categories = await this.validation.listBillerCategories();
    const dataCategory = categories.find(
      (cat) =>
        cat.categoryCode?.toUpperCase() === 'DATA_BUNDLE' ||
        cat.categoryName?.toLowerCase().includes('data bundle') ||
        false,
    );
    if (!dataCategory?.categoryCode) {
      throw new BadRequestException('Monnify billing error: no data bundle category found');
    }
    return dataCategory.categoryCode;
  }

  async resolveBiller(categoryCode: 'AIRTIME' | 'DATA_BUNDLE', network: MonnifyTelcoNetwork) {
    const actualCategoryCode =
      categoryCode === 'AIRTIME'
        ? await this.findAirtimeCategory()
        : await this.findDataBundleCategory();
    const billers = await this.validation.listBillers(actualCategoryCode);
    const match = billers.find((biller) => this.validation.matchesNetwork(biller.name, network));
    if (!match || !this.validation.billerId(match)) {
      throw new BadRequestException(
        `Monnify billing error: no ${categoryCode.toLowerCase()} biller for ${network} (${this.validation.describeBillers(billers)})`,
      );
    }
    return match;
  }

  async resolveAirtimeProduct(network: MonnifyTelcoNetwork): Promise<MonnifyProduct> {
    const biller = await this.resolveBiller('AIRTIME', network);
    const products = await this.validation.listProducts(this.validation.billerId(biller)!);
    const isAirtimeCategory = (row: MonnifyProduct): boolean =>
      (row.category?.code ?? '').toUpperCase() === 'AIRTIME';
    const product =
      products.find(
        (row) =>
          this.validation.productId(row) &&
          isAirtimeCategory(row) &&
          /airtime|top.?up/i.test(row.name ?? ''),
      ) ??
      products.find((row) => this.validation.productId(row) && isAirtimeCategory(row)) ??
      products.find((row) => this.validation.productId(row)) ??
      null;
    if (!product || !this.validation.productId(product)) {
      throw new BadRequestException(`Monnify billing error: no airtime product for ${network}`);
    }
    return product;
  }

  async resolveDataProduct(
    network: MonnifyTelcoNetwork,
    amount: number,
    dataPlanCode?: string,
  ): Promise<MonnifyProduct> {
    const biller = await this.resolveBiller('DATA_BUNDLE', network);
    const products = await this.validation.listProducts(this.validation.billerId(biller)!);
    const candidates = products.filter((row) => this.validation.productId(row));
    const product = dataPlanCode
      ? candidates.find((row) => this.validation.productId(row) === dataPlanCode)
      : (candidates.find((row) => this.validation.productAmount(row) === amount) ??
        candidates.find((row) => this.validation.productId(row) === String(amount)));
    if (!product || !this.validation.productId(product)) {
      throw new BadRequestException(
        dataPlanCode
          ? 'Monnify billing error: the selected data plan is no longer available'
          : `Monnify billing error: no data product for ${network} at amount ${amount}`,
      );
    }
    if (dataPlanCode && this.validation.productAmount(product) !== amount) {
      throw new BadRequestException(
        'Monnify billing error: selected data plan amount does not match',
      );
    }
    return product;
  }

  async listDataPlans(telco: string): Promise<MonnifyDataPlan[]> {
    const network = telco.toUpperCase() as MonnifyTelcoNetwork;
    const biller = await this.resolveBiller('DATA_BUNDLE', network);
    const products = await this.validation.listProducts(this.validation.billerId(biller)!);
    return products
      .map((row) => {
        const amount = this.validation.productAmount(row);
        const id = this.validation.productId(row);
        if (amount == null || !id) return null;
        return {
          amount,
          plan: row.name || id,
          productCode: id,
        };
      })
      .filter((row): row is MonnifyDataPlan => row != null);
  }

  normalizePhoneNumber(phoneNumber: string): string {
    let normalized = phoneNumber.replace(/\s+/g, '').replace(/[-()]/g, '');
    if (normalized.startsWith('+234')) {
      normalized = normalized.replace('+234', '234');
    } else if (normalized.startsWith('0')) {
      normalized = `234${normalized.substring(1)}`;
    } else if (!normalized.startsWith('234')) {
      normalized = `234${normalized}`;
    }
    return normalized;
  }

  async purchase(
    product: MonnifyProduct,
    input: MonnifyAirtimeInput,
  ): Promise<{ success: boolean; transactionId: string | null; status: string }> {
    const customerId = this.normalizePhoneNumber(input.phoneNumber);
    const id = this.validation.productId(product)!;
    const validation = await this.validation.validateCustomer(id, customerId);
    return this.validation.vend({
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
    const categories = await this.validation.listBillerCategories();
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
    const billers = await this.validation.listBillers(electricityCategory.categoryCode);
    return billers
      .map((biller) => ({ biller, id: this.validation.billerId(biller) }))
      .filter((row): row is { biller: MonnifyBiller; id: string } => Boolean(row.id))
      .map((row) => ({
        id: row.id,
        name: row.biller.name || row.id,
      }));
  }

  async resolveElectricityProduct(
    billerCode: string,
    serviceType: 'PREPAID' | 'POSTPAID',
  ): Promise<MonnifyProduct> {
    const products = await this.validation.listProducts(billerCode);
    const needle = serviceType.toLowerCase();
    const product =
      products.find(
        (row) => this.validation.productId(row) && (row.name ?? '').toLowerCase().includes(needle),
      ) ??
      products.find((row) => this.validation.productId(row)) ??
      null;
    if (!product || !this.validation.productId(product)) {
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
    const body = await this.validation.requestPost<{
      customerName?: string;
    }>('/api/v1/vas/bills-payment/validate-customer', {
      productCode: this.validation.productId(product),
      customerId,
    });
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
    const id = this.validation.productId(product)!;
    const validation = await this.validation.validateCustomer(id, customerId);
    const result = await this.validation.vend({
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
