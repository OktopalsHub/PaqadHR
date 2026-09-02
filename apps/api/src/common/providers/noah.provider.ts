import { BadRequestException, Injectable } from '@nestjs/common';
import { isNoahConfigured } from '../config/noah.config';
import { isNoahOperationSuccessful } from '../config/noah-api.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { NoahApiService } from '../services/noah-api.service';
import { BasePaymentProvider } from './base-payment.provider';

const DEFAULT_PAYOUT_COUNTRIES: Record<string, string> = {
  USD: 'US',
  EUR: 'DE',
  GBP: 'GB',
};

@Injectable()
export class NoahProvider extends BasePaymentProvider {
  constructor(private readonly noahApi: NoahApiService) {
    super('Noah', 'https://api.noah.com', true);
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.noah.com';
  }

  protected initializeCurrencyConfigs(): void {
    for (const code of ['USD', 'EUR', 'GBP', 'USDC', 'USDT']) {
      this.currencyConfigs.set(code, {
        code,
        name: code,
        symbol: code,
        decimals: 2,
        type: ['USDC', 'USDT'].includes(code) ? 'crypto' : 'fiat',
        isActive: true,
      });
    }
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    if (!isNoahConfigured()) {
      return {
        success: false,
        error: 'Noah payout is not configured',
        retryable: false,
      };
    }

    const currency = data.currency.toUpperCase();
    this.validateAmount(data.amount, currency);

    const merchantTxRef =
      data.merchantTxRef ||
      this.generateReference(
        `PAYROLL_${(data.metadata?.payrollItemId as string | undefined) ?? ''}`,
      );

    try {
      if (isCryptoCurrency(currency)) {
        const walletAddress = data.accountNumber?.trim() || data.metadata?.walletAddress;
        if (!walletAddress || typeof walletAddress !== 'string') {
          return {
            success: false,
            error: 'Crypto wallet address is required',
            retryable: false,
          };
        }

        const response = await this.noahApi.createCryptoPayout({
          amount: data.amount,
          cryptoCurrency: currency,
          walletAddress,
          network: data.network ?? (data.metadata?.cryptoNetwork as string | undefined),
          merchantTxRef,
          narration: data.description,
        });

        const success = isNoahOperationSuccessful(response.status);
        return {
          success,
          transactionId: response.transactionId,
          reference: merchantTxRef,
          providerStatus: response.status,
          error: success ? undefined : `Noah crypto payout ${response.status}`,
          retryable: !success,
        };
      }

      if (!data.accountNumber?.trim() || !data.accountName?.trim()) {
        return {
          success: false,
          error: 'Recipient bank account details are required',
          retryable: false,
        };
      }

      const countryCode =
        data.countryCode?.toUpperCase() || DEFAULT_PAYOUT_COUNTRIES[currency] || 'US';

      const response = await this.noahApi.createFiatPayout({
        amount: data.amount,
        fiatCurrency: currency,
        countryCode,
        merchantTxRef,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.institutionCode || data.bankCode,
        bankName: data.institutionName || data.bankName,
        paymentRail: data.paymentRail,
        accountType: data.accountType,
        bankAccountType: data.bankAccountType,
        purposeOfPayment: data.purposeOfPayment ?? 'PAYROLL',
        narration: data.description,
        channelId:
          typeof data.metadata?.noahChannelId === 'string'
            ? data.metadata.noahChannelId
            : undefined,
      });

      const success = isNoahOperationSuccessful(response.status);
      return {
        success,
        transactionId: response.transactionId,
        reference: merchantTxRef,
        providerStatus: response.status,
        error: success ? undefined : `Noah payout ${response.status}`,
        retryable: !success,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Noah payout failed: ${message}`);
      return {
        success: false,
        error: message,
        retryable: true,
      };
    }
  }

  async processWebhook(payload: unknown, signature: string): Promise<WebhookResult> {
    if (!this.noahApi.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      return { success: false, error: 'Invalid webhook signature' };
    }
    const event = this.noahApi.parseTransferWebhook(payload);
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
    return ['USD', 'EUR', 'GBP', 'USDC', 'USDT'];
  }

  validateSignature(payload: unknown, signature: string): boolean {
    return this.noahApi.verifyWebhookSignature(JSON.stringify(payload), signature);
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const verified = await this.noahApi.verifyTransaction(transactionId);
    if (!verified) {
      throw new BadRequestException('Unable to fetch Noah transaction status');
    }
    return verified.status.toLowerCase() as TransactionStatus;
  }
}
