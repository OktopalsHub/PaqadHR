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
          [
            'PENDING',
            'PROCESSING',
            'PENDING_AUTHORIZATION',
            'AWAITING_AUTHORIZATION',
            'IN_PROGRESS',
            'AWAITING_PROCESSING',
          ].includes((response.status ?? '').toUpperCase()),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Monnify payout failed: ${message}`);
      return { success: false, error: message, retryable: true, reference: merchantTxRef };
    }
  }

  async createBulkTransfer(transfers: CreatePaymentData[]): Promise<PaymentResult[]> {
    if (transfers.length === 0) return [];
    if (transfers.length === 1) {
      return [await this.createPayment(transfers[0])];
    }
    if (!isMonnifyConfigured()) {
      return transfers.map((t) => ({
        success: false,
        error: 'Monnify payout is not configured',
        retryable: false,
        reference: t.merchantTxRef,
      }));
    }

    const lines: Array<{
      amount: number;
      reference: string;
      narration: string;
      destinationBankCode: string;
      destinationAccountNumber: string;
      destinationAccountName: string;
      currencyCode: string;
    }> = [];
    const earlyFailures: PaymentResult[] = [];

    for (const data of transfers) {
      const currency = data.currency.toUpperCase();
      const merchantTxRef =
        data.merchantTxRef ||
        this.generateReference(
          `PAYROLL_${(data.metadata?.payrollItemId as string | undefined) ?? ''}`,
        );
      if (currency !== 'NGN') {
        earlyFailures.push({
          success: false,
          error: `Currency ${currency} is handled by Noah, not Monnify`,
          retryable: false,
          reference: merchantTxRef,
        });
        continue;
      }
      if (!data.accountNumber?.trim() || !data.accountName?.trim() || !data.bankCode?.trim()) {
        earlyFailures.push({
          success: false,
          error: 'Recipient bank account details are required',
          retryable: false,
          reference: merchantTxRef,
        });
        continue;
      }
      try {
        this.validateAmount(data.amount, currency);
      } catch (error) {
        earlyFailures.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: false,
          reference: merchantTxRef,
        });
        continue;
      }
      lines.push({
        amount: data.amount,
        reference: merchantTxRef,
        narration: data.description || 'Payroll disbursement',
        destinationBankCode: data.bankCode,
        destinationAccountNumber: data.accountNumber,
        destinationAccountName: data.accountName,
        currencyCode: currency,
      });
    }

    if (lines.length === 0) {
      return earlyFailures;
    }

    try {
      const batchReference = this.generateReference('BATCH');
      const responses = await this.monnifyApi.batchTransfer({
        title: 'Payroll disbursement',
        batchReference,
        narration: 'Payroll disbursement',
        transactions: lines,
      });
      const bulkResults = responses.map((response) => ({
        success: response.success,
        transactionId: response.reference,
        reference: response.reference,
        providerStatus: response.status,
        error: response.success ? undefined : response.message,
        retryable:
          !response.success &&
          [
            'PENDING',
            'PROCESSING',
            'IN_PROGRESS',
            'AWAITING_PROCESSING',
            'PENDING_AUTHORIZATION',
            'AWAITING_AUTHORIZATION',
          ].includes((response.status ?? '').toUpperCase()),
      }));
      return [...earlyFailures, ...bulkResults];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Monnify batch payout failed: ${message}`);
      return [
        ...earlyFailures,
        ...lines.map((line) => ({
          success: false,
          error: message,
          retryable: true,
          reference: line.reference,
        })),
      ];
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
