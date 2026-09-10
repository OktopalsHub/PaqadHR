import { BadRequestException, Injectable } from '@nestjs/common';
import { getNoahPayoutCryptoCurrency } from '../config/noah.config';
import { NoahAuthService } from './noah-auth.service';

export interface NoahFiatPayoutInput {
  amount: number;
  fiatCurrency: string;
  cryptoCurrency?: string;
  countryCode: string;
  channelId?: string;
  merchantTxRef: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  bankName?: string;
  paymentRail?: string;
  accountType?: 'INDIVIDUAL' | 'CORPORATE';
  bankAccountType?: 'CHECKING' | 'SAVINGS';
  purposeOfPayment?: string;
  narration?: string;
}

export interface NoahCryptoPayoutInput {
  amount: number;
  cryptoCurrency: string;
  walletAddress: string;
  network?: string;
  merchantTxRef: string;
  narration?: string;
}

@Injectable()
export class NoahPayoutService {
  constructor(private readonly auth: NoahAuthService) {}

  async createFiatPayout(input: NoahFiatPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const cryptoCurrency = input.cryptoCurrency ?? getNoahPayoutCryptoCurrency();
    const channels = await this.auth.request<{
      channels?: Array<{ id?: string; channelID?: string }>;
    }>('GET', '/channels/sell', undefined, {
      country: input.countryCode.toUpperCase(),
      fiatCurrency: input.fiatCurrency.toUpperCase(),
      cryptoCurrency,
    });

    const channelId =
      input.channelId ?? channels.channels?.[0]?.channelID ?? channels.channels?.[0]?.id;
    if (!channelId) {
      throw new BadRequestException(
        `No Noah payout channel for ${input.fiatCurrency} in ${input.countryCode}`,
      );
    }

    const form: Record<string, unknown> = {
      AccountHolderName: {
        AccountHolderType: input.accountType === 'CORPORATE' ? 'Business' : 'Individual',
        Name: { FullName: input.accountName },
      },
      BankDetails: {
        AccountNumber: input.accountNumber,
        BankCode: input.bankCode,
        BankName: input.bankName,
        AccountType: input.bankAccountType ?? 'Checking',
      },
      PaymentPurpose: input.purposeOfPayment ?? 'Payroll',
      Reference: input.merchantTxRef,
    };

    const prepared = await this.auth.request<{
      transactionID?: string;
      transactionId?: string;
      payoutID?: string;
      payoutId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/sell/prepare',
      {
        channelID: channelId,
        cryptoCurrency,
        fiatAmount: String(input.amount),
        fiatCurrency: input.fiatCurrency.toUpperCase(),
        form,
        externalID: input.merchantTxRef,
        narration: input.narration,
      },
      undefined,
      input.merchantTxRef,
    );

    const prepareId =
      prepared.payoutID ?? prepared.payoutId ?? prepared.transactionID ?? prepared.transactionId;
    if (!prepareId) {
      throw new BadRequestException('Noah payout prepare did not return a transaction id');
    }

    const executed = await this.auth.request<{
      transactionID?: string;
      transactionId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/sell',
      {
        transactionID: prepareId,
        externalID: input.merchantTxRef,
      },
      undefined,
      input.merchantTxRef,
    );

    return {
      transactionId:
        executed.transactionID ?? executed.transactionId ?? prepareId ?? input.merchantTxRef,
      status: executed.status ?? prepared.status ?? 'PROCESSING',
    };
  }

  async createCryptoPayout(input: NoahCryptoPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const payload = await this.auth.request<{
      transactionID?: string;
      transactionId?: string;
      status?: string;
    }>(
      'POST',
      '/transactions/send',
      {
        cryptoCurrency: input.cryptoCurrency.toUpperCase(),
        amount: String(input.amount),
        destinationAddress: input.walletAddress,
        network: input.network,
        externalID: input.merchantTxRef,
        narration: input.narration,
      },
      undefined,
      input.merchantTxRef,
    );

    return {
      transactionId: payload.transactionID ?? payload.transactionId ?? input.merchantTxRef,
      status: payload.status ?? 'PROCESSING',
    };
  }
}
