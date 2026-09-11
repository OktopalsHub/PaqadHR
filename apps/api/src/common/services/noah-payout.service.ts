import { BadRequestException, Injectable } from '@nestjs/common';
import { getNoahEnvironment, getNoahPayoutCryptoCurrency } from '../config/noah.config';
import { normalizeCryptoNetwork } from '../constants/crypto-currencies.constant';
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
  customerId?: string;
  /** Optional holder address for rails that require it (e.g. USD ACH). */
  holderAddress?: {
    line1: string;
    city: string;
    postalCode: string;
    state: string;
    countryCode: string;
  };
}

export interface NoahCryptoPayoutInput {
  amount: number;
  cryptoCurrency: string;
  walletAddress: string;
  network?: string;
  merchantTxRef: string;
  narration?: string;
  accountName?: string;
}

interface NoahChannelItem {
  ID?: string;
  id?: string;
  PaymentMethodCategory?: string;
  PaymentMethodType?: string;
  FiatCurrency?: string;
}

interface NoahChannelsResponse {
  Items?: NoahChannelItem[];
  channels?: NoahChannelItem[];
}

interface NoahPrepareResponse {
  FormSessionID?: string;
  CryptoAuthorizedAmount?: string;
  CryptoAmountEstimate?: string;
  FiatAmount?: string;
  CryptoCurrency?: string;
  NextStep?: { StepID?: string };
}

interface NoahSellResponse {
  Transaction?: { ID?: string; Status?: string };
  transactionID?: string;
  status?: string;
}

interface NoahWithdrawResponse {
  Transaction?: { ID?: string; Status?: string };
}

function resolveNoahCryptoAsset(code: string): string {
  const upper = code.toUpperCase();
  if (getNoahEnvironment() === 'production') {
    if (upper.endsWith('_TEST') || upper.includes('_TEST_')) {
      return upper.replace(/_TEST(_SEPOLIA)?$/i, '').replace(/_TEST_/i, '_');
    }
    if (upper === 'ETH_TEST_SEPOLIA') return 'ETH';
    return upper;
  }
  if (upper === 'USDC' || upper === 'USDC_TEST') return 'USDC_TEST';
  if (upper === 'USDT' || upper === 'USDT_TEST') return 'USDT_TEST';
  if (upper === 'BTC' || upper === 'BTC_TEST') return 'BTC_TEST';
  if (upper === 'ETH' || upper === 'ETH_TEST' || upper === 'ETH_TEST_SEPOLIA') {
    return 'ETH_TEST_SEPOLIA';
  }
  if (upper === 'SOL' || upper === 'SOL_TEST') return 'SOL_TEST';
  return upper.endsWith('_TEST') || upper.includes('_TEST') ? upper : `${upper}_TEST`;
}

function resolveNoahNetwork(currency: string, network?: string): string {
  const normalized = network ? normalizeCryptoNetwork(currency, network) : null;
  const isSandbox = getNoahEnvironment() !== 'production';
  const base =
    normalized ??
    (currency.toUpperCase() === 'BTC'
      ? 'Bitcoin'
      : currency.toUpperCase() === 'SOL'
        ? 'Solana'
        : 'Ethereum');
  if (!isSandbox) return base === 'PolygonPos' ? 'PolygonPos' : base;
  if (base === 'Ethereum') return 'EthereumTestSepolia';
  if (base === 'Base') return 'BaseTestSepolia';
  if (base === 'PolygonPos' || base === 'Polygon') return 'PolygonTestAmoy';
  if (base === 'Solana') return 'SolanaDevnet';
  if (base === 'Bitcoin') return 'BitcoinTest';
  return base;
}

@Injectable()
export class NoahPayoutService {
  constructor(private readonly auth: NoahAuthService) {}

  async createFiatPayout(input: NoahFiatPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const cryptoCurrency = resolveNoahCryptoAsset(
      input.cryptoCurrency ?? getNoahPayoutCryptoCurrency(),
    );
    const channels = await this.auth.request<NoahChannelsResponse>(
      'GET',
      '/channels/sell',
      undefined,
      {
        Country: input.countryCode.toUpperCase(),
        FiatCurrency: input.fiatCurrency.toUpperCase(),
        CryptoCurrency: cryptoCurrency,
      },
    );

    const items = channels.Items ?? channels.channels ?? [];
    const preferredTypes = ['BankAch', 'BankSepa', 'BankLocal', 'BankFasterPayments'];
    const bankChannel =
      preferredTypes
        .map((type) => items.find((item) => item.PaymentMethodType === type))
        .find(Boolean) ??
      items.find((item) => (item.PaymentMethodCategory || '').toLowerCase() === 'bank') ??
      items[0];
    const channelId = input.channelId ?? bankChannel?.ID ?? bankChannel?.id;
    if (!channelId) {
      throw new BadRequestException(
        `No Noah payout channel for ${input.fiatCurrency} in ${input.countryCode}`,
      );
    }

    const [firstName, ...rest] = input.accountName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    const bankDetails: Record<string, unknown> = {
      AccountNumber: input.accountNumber,
      AccountType: input.bankAccountType === 'SAVINGS' ? 'Savings' : 'Checking',
    };
    if (input.fiatCurrency.toUpperCase() === 'USD') {
      bankDetails.RoutingNumber = input.bankCode;
    } else if (input.fiatCurrency.toUpperCase() === 'EUR') {
      if (input.bankCode) bankDetails.Bic = input.bankCode;
    } else if (input.bankCode) {
      bankDetails.BankCode = input.bankCode;
    }
    if (input.bankName) bankDetails.BankName = input.bankName;

    const form: Record<string, unknown> = {
      AccountHolderName: {
        AccountHolderType: input.accountType === 'CORPORATE' ? 'Business' : 'Individual',
        Name: { FirstName: firstName, LastName: lastName },
      },
      BankDetails: bankDetails,
      Reference: input.merchantTxRef.slice(0, 36),
    };

    if (input.fiatCurrency.toUpperCase() === 'USD') {
      form.AccountHolderAddress = input.holderAddress ?? {
        line1: '1 Business Street',
        city: 'New York',
        postalCode: '10001',
        state: 'NY',
        countryCode: 'US',
      };
    }

    const prepared = await this.auth.request<NoahPrepareResponse>(
      'POST',
      '/transactions/sell/prepare',
      {
        ChannelID: channelId,
        CryptoCurrency: cryptoCurrency,
        FiatAmount: String(input.amount),
        Form: form,
        DelayedSell: true,
        ...(input.customerId ? { CustomerID: input.customerId } : {}),
      },
      undefined,
      input.merchantTxRef,
    );

    if (!prepared.FormSessionID || !prepared.CryptoAuthorizedAmount) {
      throw new BadRequestException(
        prepared.NextStep?.StepID
          ? `Noah payout prepare needs additional step: ${prepared.NextStep.StepID}`
          : 'Noah payout prepare did not return FormSessionID',
      );
    }

    const executed = await this.auth.request<NoahSellResponse>(
      'POST',
      '/transactions/sell',
      {
        CryptoCurrency: cryptoCurrency,
        FiatAmount: prepared.FiatAmount ?? String(input.amount),
        CryptoAuthorizedAmount: prepared.CryptoAuthorizedAmount,
        FormSessionID: prepared.FormSessionID,
        Nonce: input.merchantTxRef.slice(0, 36),
        ExternalID: input.merchantTxRef.slice(0, 36),
      },
      undefined,
      `${input.merchantTxRef}_sell`,
    );

    return {
      transactionId: executed.Transaction?.ID ?? input.merchantTxRef,
      status: executed.Transaction?.Status ?? executed.status ?? 'Pending',
    };
  }

  async createCryptoPayout(input: NoahCryptoPayoutInput): Promise<{
    transactionId: string;
    status: string;
  }> {
    const cryptoCurrency = resolveNoahCryptoAsset(input.cryptoCurrency);
    const network = resolveNoahNetwork(input.cryptoCurrency, input.network);
    const [firstName, ...rest] = (input.accountName ?? 'Payroll Recipient').trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    const payload = await this.auth.request<NoahWithdrawResponse>(
      'POST',
      '/transactions/withdraw',
      {
        CryptoCurrency: cryptoCurrency,
        Network: network,
        Amount: String(input.amount),
        DestinationAddress: { Address: input.walletAddress },
        Nonce: input.merchantTxRef.slice(0, 36),
        ExternalID: input.merchantTxRef.slice(0, 36),
        TravelRule: {
          Beneficiary: {
            Type: 'Individual',
            FullName: { FirstName: firstName, LastName: lastName },
            AccountNumber: input.walletAddress,
          },
        },
      },
      undefined,
      input.merchantTxRef,
    );

    return {
      transactionId: payload.Transaction?.ID ?? input.merchantTxRef,
      status: payload.Transaction?.Status ?? 'Pending',
    };
  }
}
