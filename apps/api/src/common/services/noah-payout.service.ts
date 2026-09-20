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
  FormSchema?: Record<string, unknown>;
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

function getChannelId(channel: NoahChannelItem): string | undefined {
  return channel.ID ?? channel.id;
}

function validateNoahFormAgainstSchema(
  channel: NoahChannelItem,
  form: Record<string, unknown>,
): void {
  const schema = channel.FormSchema;
  if (!schema) return;
  const required = Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === 'string')
    : [];
  const missing = required.filter((field) => form[field] === undefined || form[field] === null);
  if (missing.length > 0) {
    throw new BadRequestException(
      `Noah payout channel requires fields not available in payroll data: ${missing.join(', ')}`,
    );
  }
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
    const preferredTypes =
      input.fiatCurrency.toUpperCase() === 'EUR'
        ? ['BankSepa', 'BankSwift', 'BankLocal']
        : input.fiatCurrency.toUpperCase() === 'USD'
          ? ['BankAch', 'BankFedwire', 'BankSwift']
          : ['BankLocal', 'BankSwift'];

    const bankChannels = items.filter(
      (item) => (item.PaymentMethodCategory || '').toLowerCase() === 'bank',
    );
    const requestedChannel = input.channelId
      ? bankChannels.find((item) => getChannelId(item) === input.channelId)
      : undefined;
    const bankChannel =
      requestedChannel ??
      preferredTypes
        .map((type) => bankChannels.find((item) => item.PaymentMethodType === type))
        .find(Boolean) ??
      bankChannels[0];
    const channelId = bankChannel ? getChannelId(bankChannel) : undefined;
    if (!channelId || !bankChannel) {
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
      bankDetails.BankCode = input.bankCode;
    } else if (input.fiatCurrency.toUpperCase() === 'EUR') {
      // Noah's EUR SEPA form uses the beneficiary IBAN as AccountNumber.
      // BIC is only included when the selected channel accepts it.
      if (input.bankCode) bankDetails.BankCode = input.bankCode;
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
      PaymentPurpose: input.purposeOfPayment ?? 'PAYROLL',
    };

    if (input.holderAddress) {
      form.AccountHolderAddress = {
        Address: input.holderAddress.line1,
        City: input.holderAddress.city,
        PostalCode: input.holderAddress.postalCode,
        State: input.holderAddress.state,
        CountryCode: input.holderAddress.countryCode.toUpperCase(),
      };
    }

    validateNoahFormAgainstSchema(bankChannel, form);

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
