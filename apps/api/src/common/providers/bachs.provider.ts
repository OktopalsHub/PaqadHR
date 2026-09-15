import { Injectable } from '@nestjs/common';
import {
  getBachsBaseUrl,
  getBachsPayoutSourceCurrency,
  isBachsConfigured,
} from '../config/bachs.config';
import { mapBachsCryptoDestinationCurrency } from '../config/bachs-payout.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import { BachsApiError, BachsApiService } from '../services/bachs-api.service';
import { BasePaymentProvider } from './base-payment.provider';
import { PaymentProviderError } from './payment-provider.interface';

/** Error codes that will never succeed on retry — do not requeue these payroll items. */
const NON_RETRYABLE_ERROR_CODES = new Set([
  'INSUFFICIENT_BALANCE',
  'ORGANIZATION_IN_DEBT',
  'DESTINATION_REJECTED',
  'DESTINATION_PENDING_REVIEW',
  'PAYOUTS_NOT_ENABLED',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
]);

const DESTINATION_CACHE_TTL_MS = 10 * 60 * 1000;

type BachsDestinationInput = {
  currency: string;
  accountNumber?: string;
  bankCode?: string;
  walletAddress?: string;
  network?: string;
};

/** Uppercase a currency value from payout metadata, or undefined when absent/blank. */
function readMetadataCurrency(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.trim().toUpperCase();
}

@Injectable()
export class BachsProvider extends BasePaymentProvider {
  /** In-memory destination cache: Bachs resolves+approves a destination on create, so a
   * short-lived cache avoids one extra API call per payout within a payroll run. */
  private readonly destinationCache = new Map<string, { id: string; cachedAt: number }>();

  constructor(private readonly bachsApi: BachsApiService) {
    super('Bachs', getBachsBaseUrl(), true);
  }

  protected getDefaultBaseUrl(): string {
    return getBachsBaseUrl();
  }

  protected initializeCurrencyConfigs(): void {
    for (const code of ['NGN', 'USD', 'USDT']) {
      this.currencyConfigs.set(code, {
        code,
        name: code,
        symbol: code,
        decimals: 2,
        type: code === 'USDT' ? 'crypto' : 'fiat',
        isActive: true,
      });
    }
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    if (!isBachsConfigured()) {
      return { success: false, error: 'Bachs payout is not configured', retryable: false };
    }

    const currency = data.currency.toUpperCase();
    this.validateAmount(data.amount, currency);

    const merchantTxRef =
      data.merchantTxRef ||
      this.generateReference(
        `PAYROLL_${(data.metadata?.payrollItemId as string | undefined) ?? ''}`,
      );

    try {
      const destinationInput = this.resolveDestinationInput(data, currency);
      const destinationCurrency = destinationInput.currency;

      // Bachs debits a per-currency balance. FX-at-payout items carry the salary-currency
      // amount; everything else carries the payout-currency amount. Whichever it is, that
      // currency is the quote's `from_currency` (a pre-converted amount cannot be re-quoted).
      const destinationBaseCurrency = destinationCurrency.split('_')[0];
      const fxAtPayout = data.metadata?.fxAtPayout === true;
      const salaryCurrency = readMetadataCurrency(data.metadata?.salaryCurrency);
      const declaredSource =
        readMetadataCurrency(data.metadata?.bachsSourceCurrency) ?? getBachsPayoutSourceCurrency();
      const amountCurrency = fxAtPayout && salaryCurrency ? salaryCurrency : destinationCurrency;

      if (declaredSource && declaredSource !== amountCurrency) {
        return {
          success: false,
          retryable: false,
          error:
            `Bachs balance source ${declaredSource} cannot fund this ${destinationCurrency} payout ` +
            `because the item amount is denominated in ${amountCurrency}; fund the ` +
            `${amountCurrency} balance or unset BACHS_PAYOUT_SOURCE_CURRENCY`,
        };
      }

      let amount: string | undefined;
      let quoteId: string | undefined;
      if (amountCurrency === destinationCurrency || amountCurrency === destinationBaseCurrency) {
        // Same currency, or the same asset on another chain (USDT → USDT_TRC20).
        amount = data.amount.toFixed(2);
      } else {
        const quote = await this.bachsApi.createPayoutQuote({
          fromCurrency: amountCurrency,
          toCurrency: destinationCurrency,
          amount: data.amount.toFixed(2),
        });
        quoteId = quote.quote_id;
      }

      const destinationId = await this.resolveDestinationId(destinationInput);
      const payout = await this.bachsApi.createPayout({
        destination: destinationId,
        amount,
        quoteId,
        reference: merchantTxRef,
        idempotencyKey: merchantTxRef,
      });

      const status = (payout.status ?? 'pending').toLowerCase();
      if (status === 'failed') {
        return {
          success: false,
          outcome: 'failed',
          transactionId: payout.id,
          reference: merchantTxRef,
          providerStatus: status,
          error: payout.failure_reason ?? `Bachs payout ${status}`,
          retryable: false,
        };
      }

      return {
        success: true,
        outcome: status === 'completed' ? 'paid' : 'processing',
        transactionId: payout.id,
        reference: merchantTxRef,
        providerStatus: status,
        rail: destinationCurrency.startsWith('USDT') ? 'crypto' : 'bank',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bachs payout failed: ${message}`);
      const errorCode = error instanceof BachsApiError ? error.errorCode : undefined;
      const retryable =
        error instanceof PaymentProviderError
          ? error.retryable
          : !(errorCode && NON_RETRYABLE_ERROR_CODES.has(errorCode));
      return {
        success: false,
        error: message,
        retryable,
      };
    }
  }

  async processWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return { success: false, error: 'Use BachsWebhookService for webhook handling' };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN', 'USDT'];
  }

  /** Bachs signatures need the timestamp header; verification happens in BachsWebhookService. */
  validateSignature(_payload: unknown, _signature: string): boolean {
    return false;
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const payout = await this.bachsApi.getPayout(transactionId);
    if (!payout) {
      throw new PaymentProviderError(
        'Unable to fetch Bachs transaction status',
        'NOT_FOUND',
        false,
      );
    }
    const status = (payout.status ?? '').toLowerCase();
    if (status === 'completed') return TransactionStatus.COMPLETED;
    if (status === 'failed') return TransactionStatus.FAILED;
    if (status === 'processing') return TransactionStatus.PROCESSING;
    return TransactionStatus.PENDING;
  }

  private resolveDestinationInput(
    data: CreatePaymentData,
    currency: string,
  ): BachsDestinationInput {
    if (currency === 'NGN') {
      if (!data.accountNumber?.trim() || !data.bankCode?.trim()) {
        throw new PaymentProviderError(
          'Recipient bank account and bank code are required for NGN payouts',
          'VALIDATION_ERROR',
          false,
        );
      }
      return {
        currency: 'NGN',
        accountNumber: data.accountNumber.trim(),
        bankCode: data.bankCode.trim(),
      };
    }

    if (isCryptoCurrency(currency)) {
      if (currency !== 'USDT') {
        throw new PaymentProviderError(
          `Bachs only supports USDT crypto payouts, not ${currency}`,
          'VALIDATION_ERROR',
          false,
        );
      }
      const walletAddress =
        data.accountNumber?.trim() ||
        (typeof data.metadata?.walletAddress === 'string'
          ? data.metadata.walletAddress.trim()
          : '');
      if (!walletAddress) {
        throw new PaymentProviderError(
          'Crypto wallet address is required for USDT payouts',
          'VALIDATION_ERROR',
          false,
        );
      }
      const network =
        data.network ??
        (typeof data.metadata?.cryptoNetwork === 'string'
          ? data.metadata.cryptoNetwork
          : undefined);
      const destinationCurrency = mapBachsCryptoDestinationCurrency(network);
      if (!destinationCurrency) {
        throw new PaymentProviderError(
          'Bachs USDT payouts require an explicit TRC20 or BEP20 network',
          'VALIDATION_ERROR',
          false,
        );
      }
      return {
        currency: destinationCurrency,
        walletAddress,
        network: destinationCurrency.split('_')[1],
      };
    }

    throw new PaymentProviderError(
      `Bachs does not support ${currency} payouts; supported: NGN bank transfer and USDT (TRC20/BEP20)`,
      'VALIDATION_ERROR',
      false,
    );
  }

  private async resolveDestinationId(input: BachsDestinationInput): Promise<string> {
    const cacheKey = [
      input.currency,
      input.accountNumber ?? '',
      input.bankCode ?? '',
      input.walletAddress ?? '',
    ].join('|');
    const cached = this.destinationCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < DESTINATION_CACHE_TTL_MS) {
      return cached.id;
    }

    const destination = await this.bachsApi.createPayoutDestination(input);
    if (
      !destination.is_usable ||
      destination.status === 'pending_review' ||
      destination.status === 'rejected'
    ) {
      throw new PaymentProviderError(
        `Bachs payout destination is not usable (status: ${destination.status ?? 'unknown'})`,
        destination.status === 'rejected' ? 'DESTINATION_REJECTED' : 'DESTINATION_PENDING_REVIEW',
        false,
      );
    }

    this.destinationCache.set(cacheKey, { id: destination.id, cachedAt: Date.now() });
    return destination.id;
  }
}
