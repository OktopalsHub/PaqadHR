import { Injectable, NotImplementedException } from '@nestjs/common';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { BasePaymentProvider } from './base-payment.provider';

@Injectable()
export class NombaProvider extends BasePaymentProvider {
  constructor() {
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
  async createPayment(_data: CreatePaymentData): Promise<PaymentResult> {
    this.logger.warn('NombaProvider.createPayment stub called');
    return {
      success: false,
      error: 'Nomba payment provider is not configured',
      retryable: false,
    };
  }
  async processWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    this.logger.warn('NombaProvider.processWebhook stub called');
    return { success: false, error: 'Nomba webhooks are not configured' };
  }
  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN', 'USD', 'GBP', 'EUR'];
  }
  validateSignature(_payload: unknown, _signature: string): boolean {
    return false;
  }
  async getTransactionStatus(_transactionId: string): Promise<TransactionStatus> {
    throw new NotImplementedException('Nomba provider is not configured');
  }
}
