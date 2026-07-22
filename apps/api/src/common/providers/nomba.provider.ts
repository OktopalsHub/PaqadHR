import { BadRequestException, Injectable } from '@nestjs/common';
import {
  formatNombaSenderName,
  getNombaBaseUrl,
  isNombaConfigured,
  NOMBA_PRODUCTION_BASE_URL,
} from '../config/nomba.config';
import { isNombaOperationSuccessful } from '../config/nomba-api.util';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { BasePaymentProvider } from './base-payment.provider';

@Injectable()
export class NombaProvider extends BasePaymentProvider {
  constructor(private readonly nombaTransferApi: NombaTransferApiService) {
    super('Nomba', getNombaBaseUrl() || NOMBA_PRODUCTION_BASE_URL, true);
  }

  protected getDefaultBaseUrl(): string {
    return getNombaBaseUrl();
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
      if (currency !== 'NGN') {
        return {
          success: false,
          error: `Currency ${currency} is handled by Noah, not Nomba`,
          retryable: false,
        };
      }

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
      const success = isNombaOperationSuccessful({ code: response.code, status });

      return {
        success,
        transactionId: response.data?.id ?? merchantTxRef,
        reference: merchantTxRef,
        providerStatus: status,
        error: success ? undefined : response.description,
        retryable: !success,
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
    return ['NGN'];
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
