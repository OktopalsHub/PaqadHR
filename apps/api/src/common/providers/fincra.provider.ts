import { Injectable } from '@nestjs/common';
import { isFincraConfigured } from '../config/fincra.config';
import { defaultFincraBeneficiaryCountry } from '../config/fincra-api.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { FincraApiService, type FincraInitiatePayoutInput } from '../services/fincra-api.service';
import { BasePaymentProvider } from './base-payment.provider';

@Injectable()
export class FincraProvider extends BasePaymentProvider {
  constructor(private readonly fincraApi: FincraApiService) {
    super('Fincra', 'https://api.fincra.com', true);
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.fincra.com';
  }

  protected initializeCurrencyConfigs(): void {
    for (const code of ['NGN', 'USD', 'EUR', 'GBP', 'USDC', 'USDT']) {
      this.currencyConfigs.set(code, {
        code,
        name: code,
        symbol: code,
        decimals: 2,
        type: isCryptoCurrency(code) ? 'crypto' : 'fiat',
        isActive: true,
      });
    }
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    if (!isFincraConfigured()) {
      return { success: false, error: 'Fincra payout is not configured', retryable: false };
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

        const cryptoNetwork = data.network ?? (data.metadata?.cryptoNetwork as string | undefined);
        if (!cryptoNetwork?.trim()) {
          return {
            success: false,
            error: 'Crypto network is required for Fincra payouts',
            retryable: false,
          };
        }

        const response = await this.fincraApi.initiatePayout({
          amount: data.amount,
          destinationCurrency: currency,
          customerReference: merchantTxRef,
          description: data.description,
          walletAddress,
          cryptoNetwork,
          accountName: data.accountName,
        });

        const accepted = response.success === true;
        const pending = accepted && this.fincraApi.isOperationPending(response.status);
        return {
          success: accepted,
          transactionId: response.reference,
          reference: merchantTxRef,
          providerStatus: response.status,
          error: accepted ? undefined : (response.message ?? `Fincra payout ${response.status}`),
          retryable: pending,
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
        data.countryCode?.toUpperCase() ?? defaultFincraBeneficiaryCountry(currency);

      const institution = data.institutionCode ?? data.bankCode;
      const payoutInput: FincraInitiatePayoutInput = {
        amount: data.amount,
        destinationCurrency: currency,
        customerReference: merchantTxRef,
        description: data.description,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        countryCode,
      };

      if (currency === 'GBP') {
        payoutInput.sortCode = institution;
      } else if (currency === 'EUR') {
        payoutInput.bankSwiftCode = institution;
      } else {
        payoutInput.bankCode = institution ?? data.bankCode;
      }

      const response = await this.fincraApi.initiatePayout(payoutInput);

      const accepted = response.success === true;
      const pending = accepted && this.fincraApi.isOperationPending(response.status);
      return {
        success: accepted,
        transactionId: response.reference,
        reference: merchantTxRef,
        providerStatus: response.status,
        error: accepted ? undefined : (response.message ?? `Fincra payout ${response.status}`),
        retryable:
          pending ||
          (!accepted &&
            (this.fincraApi.isOperationPending(response.status) ||
              (response.message ?? '').toLowerCase().includes('status lookup failed'))),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fincra payout failed: ${message}`);
      return { success: false, error: message, retryable: true };
    }
  }

  async processWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return {
      success: false,
      error: 'Use FincraWebhookService for webhook handling',
    };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN', 'USD', 'EUR', 'GBP', 'USDC', 'USDT'];
  }

  validateSignature(payload: unknown, signature: string): boolean {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return this.fincraApi.verifyWebhookSignature(rawBody, signature);
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const verified = await this.fincraApi.getPayoutStatus(transactionId);
    if (!verified) {
      throw new Error('Unable to fetch Fincra transaction status');
    }
    return verified.status.toLowerCase() as TransactionStatus;
  }
}
