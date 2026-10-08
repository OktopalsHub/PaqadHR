import { Injectable } from '@nestjs/common';
import {
  getBachsBaseUrl,
  getBachsPayoutSourceCurrency,
  isBachsConfigured,
} from '../config/bachs.config';
import { quoteSourceAmountForDestination } from '../config/bachs-funding-quote.util';
import {
  BACHS_INTL_BANK_SOURCE_CURRENCY,
  isBachsIntlBankCurrency,
  mapBachsCryptoDestinationCurrency,
  parseBachsUkIban,
} from '../config/bachs-payout.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import type { WebhookResult } from '../interfaces/webhook-result.interface';
import {
  BachsApiError,
  BachsApiService,
  type BachsBankAddress,
  type BachsPayoutDestinationInput,
} from '../services/bachs-api.service';
import { BasePaymentProvider } from './base-payment.provider';
import { PaymentProviderError } from './payment-provider.interface';
import { runConcurrentCreatePayments } from './run-concurrent-create-payments';

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
const BACHS_PAYOUT_CONCURRENCY = 5;

/** Uppercase a currency value from payout metadata, or undefined when absent/blank. */
function readMetadataCurrency(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.trim().toUpperCase();
}

function readUsdScheme(data: CreatePaymentData): 'ach' | 'wire' | 'rtp' {
  const raw =
    (typeof data.metadata?.bachsPayoutScheme === 'string'
      ? data.metadata.bachsPayoutScheme
      : data.paymentRail) ?? 'ach';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'wire' || normalized === 'rtp' || normalized === 'ach') return normalized;
  return 'ach';
}

function readBankAddress(metadata?: Record<string, unknown>): BachsBankAddress | undefined {
  const raw = metadata?.bachsBankAddress ?? metadata?.noahHolderAddress;
  if (!raw || typeof raw !== 'object') return undefined;
  const addr = raw as Record<string, unknown>;
  const line1 = typeof addr.line1 === 'string' ? addr.line1.trim() : '';
  const city = typeof addr.city === 'string' ? addr.city.trim() : '';
  const state = typeof addr.state === 'string' ? addr.state.trim() : '';
  const postalCode =
    typeof addr.postalCode === 'string'
      ? addr.postalCode.trim()
      : typeof addr.postal_code === 'string'
        ? addr.postal_code.trim()
        : '';
  const countryRaw =
    typeof addr.country === 'string'
      ? addr.country
      : typeof addr.countryCode === 'string'
        ? addr.countryCode
        : '';
  const country = countryRaw.trim().toUpperCase();
  if (!line1 || !city || !state || !postalCode || !country) return undefined;
  return { line1, city, state, postalCode, country };
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
    for (const code of ['NGN', 'USD', 'EUR', 'GBP', 'USDT']) {
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
      // amount; everything else carries the payout-currency amount. International bank
      // routes always debit USD. Mixed runs fund one balance (usually USD) then quote
      // each destination from that source via bachsSourceCurrency / BACHS_PAYOUT_SOURCE_CURRENCY.
      const destinationBaseCurrency = destinationCurrency.split('_')[0];
      const intlBank = isBachsIntlBankCurrency(destinationBaseCurrency);
      const fxAtPayout = data.metadata?.fxAtPayout === true;
      const salaryCurrency = readMetadataCurrency(data.metadata?.salaryCurrency);
      const declaredSource =
        readMetadataCurrency(data.metadata?.bachsSourceCurrency) ?? getBachsPayoutSourceCurrency();
      const amountCurrency =
        fxAtPayout && salaryCurrency ? salaryCurrency : destinationBaseCurrency;

      // Intl bank routes always debit USD. A mixed-provider float top-up may stamp an
      // NGN fundingCurrency onto metadata — ignore that for USD/EUR/GBP destinations.
      // Only the global env override can misconfigure the intl source.
      if (intlBank) {
        const envSource = getBachsPayoutSourceCurrency();
        if (envSource && envSource !== BACHS_INTL_BANK_SOURCE_CURRENCY) {
          return {
            success: false,
            retryable: false,
            error:
              `Bachs international bank payouts debit ${BACHS_INTL_BANK_SOURCE_CURRENCY} only; ` +
              `unset BACHS_PAYOUT_SOURCE_CURRENCY or set it to USD`,
          };
        }
      }

      const sourceCurrency = intlBank
        ? BACHS_INTL_BANK_SOURCE_CURRENCY
        : (declaredSource ?? amountCurrency);
      const bankMethod =
        destinationBaseCurrency === 'USDT' ? undefined : ('BANK_TRANSFER' as const);

      let amount: string | undefined;
      let quoteId: string | undefined;
      if (intlBank && destinationBaseCurrency !== 'USD') {
        // EUR/GBP banks are funded from USD. When the item amount is already USD (FX-at-payout),
        // quote that source amount; otherwise target the destination salary amount.
        if (amountCurrency === 'USD') {
          const quote = await this.bachsApi.createPayoutQuote({
            fromCurrency: BACHS_INTL_BANK_SOURCE_CURRENCY,
            toCurrency: destinationBaseCurrency,
            amount: data.amount.toFixed(2),
            payoutMethod: 'BANK_TRANSFER',
          });
          quoteId = quote.quote_id;
        } else if (amountCurrency === destinationBaseCurrency) {
          const quoted = await quoteSourceAmountForDestination({
            createQuote: (input) => this.bachsApi.createPayoutQuote(input),
            fromCurrency: BACHS_INTL_BANK_SOURCE_CURRENCY,
            toCurrency: destinationBaseCurrency,
            targetToAmount: data.amount,
            payoutMethod: 'BANK_TRANSFER',
          });
          quoteId = quoted.quoteId;
        } else {
          return {
            success: false,
            retryable: false,
            error: `Bachs ${destinationBaseCurrency} payouts need an amount in USD or ${destinationBaseCurrency}`,
          };
        }
      } else if (
        sourceCurrency === amountCurrency &&
        (amountCurrency === destinationCurrency || amountCurrency === destinationBaseCurrency)
      ) {
        // Same-currency debit (or same asset on another chain, e.g. USDT → USDT_TRC20).
        amount = data.amount.toFixed(2);
      } else if (sourceCurrency === amountCurrency) {
        // Amount already in the balance currency; quote into the destination.
        const quote = await this.bachsApi.createPayoutQuote({
          fromCurrency: sourceCurrency,
          toCurrency: destinationCurrency,
          amount: data.amount.toFixed(2),
          ...(bankMethod ? { payoutMethod: bankMethod } : {}),
        });
        quoteId = quote.quote_id;
      } else if (
        amountCurrency === destinationCurrency ||
        amountCurrency === destinationBaseCurrency
      ) {
        // Amount is what the employee receives; quote the source debit needed.
        const quoted = await quoteSourceAmountForDestination({
          createQuote: (input) => this.bachsApi.createPayoutQuote(input),
          fromCurrency: sourceCurrency,
          toCurrency: destinationCurrency,
          targetToAmount: data.amount,
          ...(bankMethod ? { payoutMethod: bankMethod } : {}),
        });
        quoteId = quoted.quoteId;
      } else {
        return {
          success: false,
          retryable: false,
          error:
            `Bachs cannot fund ${destinationCurrency} payout denominated in ${amountCurrency} ` +
            `from ${sourceCurrency}`,
        };
      }

      const cachedDestinationId =
        typeof data.metadata?.bachsDestinationId === 'string'
          ? data.metadata.bachsDestinationId.trim()
          : '';
      const destinationId =
        cachedDestinationId || (await this.resolveDestinationId(destinationInput));
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
        metadata: { bachsDestinationId: destinationId },
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

  /** Bachs exposes individual payouts rather than a payroll batch endpoint. Keep concurrency below the
   * generic provider limit because each payout can perform destination resolution + payout calls. */
  createBulkTransfer(transfers: CreatePaymentData[]): Promise<PaymentResult[]> {
    return runConcurrentCreatePayments(
      (data) => this.createPayment(data),
      transfers,
      BACHS_PAYOUT_CONCURRENCY,
    );
  }

  async processWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return { success: false, error: 'Use BachsWebhookService for webhook handling' };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['NGN', 'USD', 'EUR', 'GBP', 'USDT'];
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
  ): BachsPayoutDestinationInput {
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
        type: 'bank_account',
        accountNumber: data.accountNumber.trim(),
        bankCode: data.bankCode.trim(),
      };
    }

    if (isBachsIntlBankCurrency(currency)) {
      return this.resolveIntlBankDestination(data, currency);
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
        type: 'crypto_wallet',
        walletAddress,
        network: destinationCurrency.split('_')[1],
      };
    }

    throw new PaymentProviderError(
      `Bachs does not support ${currency} payouts; supported: NGN/USD/EUR/GBP bank and USDT (TRC20/BEP20)`,
      'VALIDATION_ERROR',
      false,
    );
  }

  private resolveIntlBankDestination(
    data: CreatePaymentData,
    currency: 'USD' | 'EUR' | 'GBP',
  ): BachsPayoutDestinationInput {
    const accountName = data.accountName?.trim();
    const bankName = (data.bankName ?? data.institutionName)?.trim();
    if (!accountName || !bankName) {
      throw new PaymentProviderError(
        `Account holder name and bank name are required for ${currency} Bachs payouts`,
        'VALIDATION_ERROR',
        false,
      );
    }

    const institution = (data.institutionCode ?? data.bankCode ?? '').trim();
    const accountRaw = (data.accountNumber ?? '').trim();
    if (!accountRaw) {
      throw new PaymentProviderError(
        `Bank account details are required for ${currency} Bachs payouts`,
        'VALIDATION_ERROR',
        false,
      );
    }

    const base: BachsPayoutDestinationInput = {
      currency,
      type: 'bank_account',
      name: `${accountName} ${currency}`,
      accountName,
      bankName,
    };

    if (currency === 'USD') {
      const routingNumber = institution.replace(/\D/g, '');
      const accountNumber = accountRaw.replace(/\D/g, '');
      const bankAddress = readBankAddress(data.metadata);
      if (!/^\d{9}$/.test(routingNumber) || !accountNumber || !bankAddress) {
        throw new PaymentProviderError(
          'USD Bachs payouts need a 9-digit routing number, account number, and US bank address',
          'VALIDATION_ERROR',
          false,
        );
      }
      if (bankAddress.country !== 'US') {
        throw new PaymentProviderError(
          'USD Bachs bank address country must be US',
          'VALIDATION_ERROR',
          false,
        );
      }
      return {
        ...base,
        scheme: readUsdScheme(data),
        routingNumber,
        accountNumber,
        bankCode: routingNumber,
        bankAddress,
      };
    }

    if (currency === 'GBP') {
      const ukIban = parseBachsUkIban(accountRaw);
      const sortCode = (institution.replace(/\D/g, '') || ukIban?.sortCode || '').trim();
      const accountNumber = ukIban?.accountNumber ?? accountRaw.replace(/\D/g, '');
      if (!/^\d{6}$/.test(sortCode) || !/^\d{6,8}$/.test(accountNumber)) {
        throw new PaymentProviderError(
          'GBP Bachs payouts need a 6-digit sort code and UK account number (or a GB IBAN)',
          'VALIDATION_ERROR',
          false,
        );
      }
      return {
        ...base,
        sortCode,
        accountNumber,
        bankCode: sortCode,
        ...(ukIban ? { iban: ukIban.iban } : {}),
      };
    }

    // EUR — SEPA
    const iban = accountRaw.replace(/\s/g, '').toUpperCase();
    const swiftBic = institution.replace(/\s/g, '').toUpperCase();
    if (iban.length < 15 || iban.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
      throw new PaymentProviderError(
        'EUR Bachs payouts need a valid IBAN',
        'VALIDATION_ERROR',
        false,
      );
    }
    if (swiftBic.length !== 8 && swiftBic.length !== 11) {
      throw new PaymentProviderError(
        'EUR Bachs payouts need an 8 or 11 character BIC / SWIFT',
        'VALIDATION_ERROR',
        false,
      );
    }
    return {
      ...base,
      iban,
      swiftBic,
      accountNumber: iban,
      bankCode: swiftBic,
    };
  }

  private async resolveDestinationId(input: BachsPayoutDestinationInput): Promise<string> {
    const cacheKey = [
      input.currency,
      input.scheme ?? '',
      input.routingNumber ?? input.sortCode ?? input.iban ?? input.bankCode ?? '',
      input.accountNumber ?? '',
      input.walletAddress ?? '',
      input.accountName ?? '',
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
