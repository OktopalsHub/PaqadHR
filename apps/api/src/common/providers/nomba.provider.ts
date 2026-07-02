import { BadRequestException, Injectable } from '@nestjs/common';
import { formatNombaSenderName, isNombaConfigured } from '../config/nomba.config';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { BasePaymentProvider } from './base-payment.provider';

const NGN_BANK_CURRENCIES = new Set(['NGN']);
const GLOBAL_PAYOUT_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);

const DEFAULT_PAYOUT_RAILS: Record<
  string,
  { paymentMethod: string; country: string; bankAccountType?: 'CHECKING' | 'SAVINGS' }
> = {
  USD: { paymentMethod: 'ACH', country: 'US', bankAccountType: 'CHECKING' },
  EUR: { paymentMethod: 'SEPA', country: 'DE' },
  GBP: { paymentMethod: 'FASTER_PAYMENTS', country: 'GB' },
};

@Injectable()
export class NombaProvider extends BasePaymentProvider {
  constructor(private readonly nombaTransferApi: NombaTransferApiService) {
    super('Nomba', 'https://api.nomba.com', true);
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.nomba.com';
  }

  protected initializeCurrencyConfigs(): void {
    ['NGN', 'USD', 'GBP', 'EUR'].forEach((code) => {
      this.currencyConfigs.set(code, {
        code,
        name: code,
        symbol: code,
        decimals: 2,
        type: 'fiat',
        isActive: true,
      });
    });
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    if (!isNombaConfigured()) {
      return {
        success: false,
        error: 'Nomba payout is not configured',
        retryable: false,
      };
    }

    const currency = data.currency.toUpperCase();
    this.validateAmount(data.amount, currency);

    if (!data.accountNumber?.trim() || !data.accountName?.trim()) {
      return {
        success: false,
        error: 'Recipient bank account details are required',
        retryable: false,
      };
    }

    const merchantTxRef =
      data.merchantTxRef ||
      this.generateReference(
        `PAYROLL_${(data.metadata?.payrollItemId as string | undefined) ?? ''}`,
      );

    try {
      if (NGN_BANK_CURRENCIES.has(currency)) {
        if (!data.bankCode?.trim()) {
          return {
            success: false,
            error: 'Bank code is required for NGN payouts',
            retryable: false,
          };
        }

        const response = await this.nombaTransferApi.bankTransfer({
          amount: data.amount,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          bankCode: data.bankCode,
          merchantTxRef,
          senderName:
            data.senderName ||
            formatNombaSenderName(
              typeof data.metadata?.tenantName === 'string' ? data.metadata.tenantName : undefined,
            ),
          narration: data.description,
        });

        const status = response.data?.status?.toUpperCase();
        const success =
          status === 'SUCCESS' || status === 'PENDING_BILLING' || response.code === '00';

        return {
          success,
          transactionId: response.data?.id ?? merchantTxRef,
          reference: merchantTxRef,
          providerStatus: status,
          error: success ? undefined : response.description,
          retryable: !success,
        };
      }

      if (GLOBAL_PAYOUT_CURRENCIES.has(currency)) {
        const rail = DEFAULT_PAYOUT_RAILS[currency];
        const destinationCountry = data.countryCode?.toUpperCase() || rail?.country;
        const paymentMethod = data.paymentRail || rail?.paymentMethod;

        if (!destinationCountry || !paymentMethod) {
          return {
            success: false,
            error: `Unsupported payout currency: ${currency}`,
            retryable: false,
          };
        }

        const response = await this.nombaTransferApi.globalPayout({
          amount: data.amount,
          sourceCurrency: currency,
          destinationCurrency: currency,
          receiverName: data.accountName,
          sourceCountryIsoCode: destinationCountry,
          destinationCountryIsoCode: destinationCountry,
          paymentMethod,
          accountNumber: data.accountNumber,
          institutionCode: data.institutionCode || data.bankCode,
          institutionName: data.institutionName || data.bankName,
          accountType: data.accountType ?? 'INDIVIDUAL',
          bankAccountType: data.bankAccountType ?? rail?.bankAccountType,
          purposeOfPayment: data.purposeOfPayment ?? 'PAYROLL',
          narration: data.description,
          merchantTxRef,
        });

        const status = response.data?.status?.toUpperCase();
        const success =
          status === 'COMPLETED' ||
          status === 'PROCESSING' ||
          status === 'PENDING' ||
          response.code === '00';

        return {
          success,
          transactionId: response.data?.id ?? merchantTxRef,
          reference: merchantTxRef,
          providerStatus: status,
          error: success ? undefined : response.description,
          retryable: !success,
        };
      }

      return {
        success: false,
        error: `Currency ${currency} is not supported for Nomba payroll payouts`,
        retryable: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Nomba payout failed: ${message}`);
      return {
        success: false,
        error: message,
        retryable: true,
      };
    }
  }

  async processWebhook(payload: unknown, signature: string): Promise<WebhookResult> {
    if (!this.nombaTransferApi.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      return { success: false, error: 'Invalid webhook signature' };
    }
    const event = this.nombaTransferApi.parseTransferWebhook(payload);
    if (!event) {
      return { success: false, error: 'Unsupported webhook event' };
    }
    return {
      success: true,
      transactionId: event.reference,
      status: event.status.toLowerCase() as WebhookResult['status'],
    };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN', 'USD', 'GBP', 'EUR'];
  }

  validateSignature(payload: unknown, signature: string): boolean {
    return this.nombaTransferApi.verifyWebhookSignature(JSON.stringify(payload), signature);
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const status = await this.nombaTransferApi.getTransactionStatus(transactionId);
    if (!status) {
      throw new BadRequestException('Unable to fetch Nomba transaction status');
    }
    return status.toLowerCase() as TransactionStatus;
  }
}
