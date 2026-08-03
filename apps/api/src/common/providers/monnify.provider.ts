import { BadRequestException, Injectable } from '@nestjs/common';
import { isMonnifyConfigured } from 'src/common/config/monnify.config';
import type { TransactionStatus } from 'src/common/enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { MonnifyApiService } from '../services/monnify-api.service';
import { BasePaymentProvider } from './base-payment.provider';

@Injectable()
export class MonnifyProvider extends BasePaymentProvider {
  constructor(private readonly monnifyApi: MonnifyApiService) {
    super('Monnify', process.env.MONNIFY_BASE_URL || 'https://api.monnify.com', true);
  }

  protected getDefaultBaseUrl(): string {
    return process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
  }

  protected initializeCurrencyConfigs(): void {
    this.currencyConfigs.set('NGN', {
      code: 'NGN',
      name: 'NGN',
      symbol: 'NGN',
      decimals: 2,
      type: 'fiat',
      isActive: true,
    });
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    if (!isMonnifyConfigured()) {
      return { success: false, error: 'Monnify payout is not configured', retryable: false };
    }

    const currency = data.currency.toUpperCase();
    this.validateAmount(data.amount, currency);

    if (currency !== 'NGN') {
      return {
        success: false,
        error: `Currency ${currency} is handled by Noah, not Monnify`,
        retryable: false,
      };
    }

    if (!data.accountNumber?.trim() || !data.accountName?.trim() || !data.bankCode?.trim()) {
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
      const response = await this.monnifyApi.singleTransfer({
        amount: data.amount,
        reference: merchantTxRef,
        narration: data.description || 'Payroll disbursement',
        destinationBankCode: data.bankCode,
        destinationAccountNumber: data.accountNumber,
        destinationAccountName: data.accountName,
        currencyCode: currency,
      });

      return {
        success: response.success,
        transactionId: response.reference,
        reference: merchantTxRef,
        providerStatus: response.status,
        error: response.success ? undefined : response.message,
        retryable:
          !response.success &&
          ['PENDING', 'PROCESSING'].includes((response.status ?? '').toUpperCase()),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Monnify payout failed: ${message}`);
      return { success: false, error: message, retryable: true };
    }
  }

  async processWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return { success: false, error: 'Use MonnifyWebhookService for disbursement webhooks' };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN'];
  }

  validateSignature(): boolean {
    return false;
  }

  async getTransactionStatus(_transactionId: string): Promise<TransactionStatus> {
    throw new BadRequestException('Monnify transaction status lookup is not implemented');
  }
}
