import { Injectable } from '@nestjs/common';
import {
  defaultFincraBeneficiaryCountry,
  isFincraOperationPending,
  isFincraOperationSuccessful,
  isFincraPayoutNotFound,
  isFincraPayoutTerminalFailure,
  normalizeFincraPayoutStatus,
  resolveFincraFiatPaymentScheme,
  resolveFincraPaymentScheme,
} from '../config/fincra-api.util';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { FincraAuthService } from './fincra-auth.service';

export interface FincraQuoteResult {
  reference: string;
  sourceAmount: number;
  destinationAmount: number;
  amountToCharge?: number;
}

export interface FincraInitiatePayoutInput {
  amount: number;
  destinationCurrency: string;
  customerReference: string;
  description?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  countryCode?: string;
  walletAddress?: string;
  cryptoNetwork?: string;
  sourceCurrency?: string;
  sortCode?: string;
  bankSwiftCode?: string;
  paymentScheme?: string;
  customerEmail?: string;
}

@Injectable()
export class FincraPayoutService {
  constructor(private readonly auth: FincraAuthService) {}

  async generateQuote(input: {
    sourceCurrency: string;
    destinationCurrency: string;
    amount: number;
    paymentDestination: 'bank_account' | 'crypto_wallet';
    paymentScheme?: string;
  }): Promise<FincraQuoteResult | null> {
    const businessId = await this.auth.resolveBusinessId();
    const body: Record<string, unknown> = {
      sourceCurrency: input.sourceCurrency.toUpperCase(),
      destinationCurrency: input.destinationCurrency.toUpperCase(),
      amount: String(input.amount),
      action: 'send',
      transactionType: 'disbursement',
      business: businessId,
      paymentDestination: input.paymentDestination,
      beneficiaryType: 'individual',
      feeBearer: 'business',
    };
    if (input.paymentScheme) body.paymentScheme = input.paymentScheme;

    const { parsed: response } = await this.auth.request<{
      reference?: string;
      sourceAmount?: number;
      destinationAmount?: number;
      amountToCharge?: number;
    }>('POST', '/quotes/generate', body);

    const data = response.data;
    if (!data?.reference) return null;

    return {
      reference: data.reference,
      sourceAmount: Number(data.sourceAmount ?? data.amountToCharge ?? input.amount),
      destinationAmount: Number(data.destinationAmount ?? input.amount),
      amountToCharge: data.amountToCharge != null ? Number(data.amountToCharge) : undefined,
    };
  }

  async initiatePayout(input: FincraInitiatePayoutInput): Promise<{
    success: boolean;
    reference?: string;
    status?: string;
    message?: string;
    sourceAmount?: number;
    destinationAmount?: number;
  }> {
    const existing = await this.getPayoutStatus(input.customerReference);
    if (existing?.status) {
      const normalized = normalizeFincraPayoutStatus(existing.status);
      if (isFincraOperationSuccessful(normalized) || isFincraOperationPending(normalized)) {
        return {
          success: true,
          reference: existing.reference ?? input.customerReference,
          status: normalized,
          destinationAmount: input.amount,
        };
      }
      if (isFincraPayoutTerminalFailure(normalized)) {
        return {
          success: false,
          reference: existing.reference ?? input.customerReference,
          status: normalized,
          message:
            'Customer reference already used for a terminal payout; submit a retry reference suffix',
        };
      }
    }

    const destinationCurrency = input.destinationCurrency.toUpperCase();
    const sourceCurrency = (
      input.sourceCurrency ?? (await this.auth.resolvePayoutSourceCurrency())
    ).toUpperCase();
    const isCrypto = isCryptoCurrency(destinationCurrency);
    const paymentDestination = isCrypto ? 'crypto_wallet' : 'bank_account';
    const country = input.countryCode ?? defaultFincraBeneficiaryCountry(destinationCurrency);
    const paymentScheme =
      input.paymentScheme ??
      (isCrypto
        ? resolveFincraPaymentScheme(destinationCurrency, input.cryptoNetwork)
        : resolveFincraFiatPaymentScheme(destinationCurrency, country));

    let quoteReference: string | undefined;
    let payoutAmount = input.amount;
    let quotedSourceAmount: number | undefined;
    let quotedDestinationAmount: number | undefined;

    if (sourceCurrency !== destinationCurrency) {
      const quote = await this.generateQuote({
        sourceCurrency,
        destinationCurrency,
        amount: input.amount,
        paymentDestination,
        paymentScheme,
      });
      if (!quote) return { success: false, message: 'Failed to generate Fincra quote' };
      quoteReference = quote.reference;
      payoutAmount = quote.amountToCharge ?? quote.sourceAmount;
      quotedSourceAmount = quote.sourceAmount;
      quotedDestinationAmount = quote.destinationAmount;
    }

    const [firstName, ...restName] = (input.accountName ?? 'Payroll Recipient').trim().split(/\s+/);
    const lastName = restName.join(' ') || firstName;

    const beneficiary: Record<string, unknown> = isCrypto
      ? {
          walletAddress: input.walletAddress,
          accountHolderName: input.accountName ?? 'Payroll Recipient',
          type: 'individual',
        }
      : {
          firstName,
          lastName,
          accountHolderName: input.accountName ?? `${firstName} ${lastName}`.trim(),
          type: 'individual',
          country,
          accountNumber: input.accountNumber,
          email: input.customerEmail ?? 'payroll@paqad.local',
        };

    if (!isCrypto) {
      if (destinationCurrency === 'GBP') {
        if (input.sortCode) beneficiary.sortCode = input.sortCode;
        else if (input.bankCode) beneficiary.sortCode = input.bankCode;
      } else if (destinationCurrency === 'EUR') {
        if (input.bankSwiftCode) beneficiary.bankSwiftCode = input.bankSwiftCode;
        else if (input.bankCode) beneficiary.bankSwiftCode = input.bankCode;
      } else if (destinationCurrency === 'USD') {
        if (input.bankCode) beneficiary.bankCode = input.bankCode;
        if (input.bankSwiftCode) beneficiary.bankSwiftCode = input.bankSwiftCode;
      } else if (input.bankCode) {
        beneficiary.bankCode = input.bankCode;
      }
    }

    const payload: Record<string, unknown> = {
      business: await this.auth.resolveBusinessId(),
      sourceCurrency,
      destinationCurrency,
      amount: payoutAmount,
      description: input.description ?? 'Payroll disbursement',
      paymentDestination,
      customerReference: input.customerReference,
      beneficiary,
    };
    if (quoteReference) payload.quoteReference = quoteReference;
    if (paymentScheme) payload.paymentScheme = paymentScheme;

    const { parsed: response } = await this.auth.request<{
      reference?: string;
      status?: string;
      customerReference?: string;
    }>('POST', '/disbursements/payouts', payload);

    const data = response.data;
    const status = normalizeFincraPayoutStatus(data?.status);
    const accepted = response.success === true || response.status === true;
    return {
      success: accepted && !status.includes('FAILED'),
      reference: data?.reference ?? input.customerReference,
      status,
      message: response.message,
      sourceAmount: quotedSourceAmount,
      destinationAmount: quotedDestinationAmount ?? input.amount,
    };
  }

  async getPayoutStatus(customerReference: string): Promise<{
    status: string;
    reference?: string;
    amount?: number;
  } | null> {
    const encoded = encodeURIComponent(customerReference);
    const { parsed: response, httpStatus } = await this.auth.request<{
      status?: string;
      reference?: string;
      amountReceived?: number;
      customerReference?: string;
    }>('GET', `/disbursements/payouts/customer-reference/${encoded}`);

    const data = response.data;
    if (data) {
      return {
        status: normalizeFincraPayoutStatus(data.status),
        reference: data.reference,
        amount: data.amountReceived,
      };
    }

    if (isFincraPayoutNotFound(httpStatus, response)) return null;

    const detail = response.message ?? `HTTP ${httpStatus}`;
    throw new Error(`Fincra payout status lookup failed: ${detail}`);
  }

  async lookupBankAccount(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName?: string } | null> {
    const { parsed: response } = await this.auth.request<{
      accountName?: string;
      accountNumber?: string;
    }>('POST', '/core/accounts/resolve', {
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      type: 'nuban',
    });
    if (!response.success && response.status !== true) return null;
    return { accountName: response.data?.accountName };
  }

  isOperationSuccessful(status?: string | null): boolean {
    return isFincraOperationSuccessful(status);
  }

  isOperationPending(status?: string | null): boolean {
    return isFincraOperationPending(status);
  }
}
