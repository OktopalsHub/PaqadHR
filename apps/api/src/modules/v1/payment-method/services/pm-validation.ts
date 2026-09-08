import { BadRequestException } from '@nestjs/common';
import {
  isCryptoCurrency,
  normalizeCryptoNetwork,
} from 'src/common/constants/crypto-currencies.constant';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import type { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import type { CreatePaymentMethodDto } from '../dto/payment-method.dto';
import {
  normalizeAccountNumber,
  validateGlobalBankFields,
} from '../utils/global-bank-validation.util';

export async function assertCurrencyAllowed(
  tenantId: string,
  currency: string,
  tenantConfigService: TenantConfigService,
  getAllowedCurrenciesFn: (tenantId: string) => Promise<string[]>,
): Promise<void> {
  const n = currency.toUpperCase();
  if (isCryptoCurrency(n)) {
    if (!(await tenantConfigService.isCryptoEnabled(tenantId)))
      throw new BadRequestException('Crypto payouts not enabled');
    return;
  }
  const allowed = await getAllowedCurrenciesFn(tenantId);
  if (!allowed.includes(n))
    throw new BadRequestException(`Currency ${n} not enabled. Allowed: ${allowed.join(', ')}`);
}

export function validatePaymentMethodData(dto: CreatePaymentMethodDto): void {
  const isCrypto = dto.type === PaymentMethodType.CRYPTO || isCryptoCurrency(dto.currency);
  if (isCrypto) {
    const w = dto.walletAddress ?? dto.accountNumber;
    if (!w?.trim()) throw new BadRequestException('Crypto requires a wallet address');
    if (!dto.currency?.trim()) throw new BadRequestException('Crypto requires a currency code');
    dto.cryptoNetwork = assertAndCanonicalizeCryptoNetwork(dto.currency, dto.cryptoNetwork);
    return;
  }
  if (dto.type && dto.type !== PaymentMethodType.BANK)
    throw new BadRequestException('Unsupported payment method type');
  if (!dto.accountNumber || !dto.accountName || !dto.bankName || !dto.country) {
    throw new BadRequestException(
      'Bank payment method requires account number, name, bank name, and country',
    );
  }
  const maxLen = dto.currency.toUpperCase() === 'EUR' ? 34 : 17;
  if (dto.accountNumber.length > maxLen)
    throw new BadRequestException(`Account number cannot exceed ${maxLen} characters`);
  validateGlobalBankFields(dto.currency.toUpperCase(), dto.accountNumber, dto.bankCode);
}

export function assertAndCanonicalizeCryptoNetwork(currency: string, network: unknown): string {
  if (typeof network !== 'string' || !network.trim())
    throw new BadRequestException('Crypto requires a network');
  const canonical = normalizeCryptoNetwork(currency, network);
  if (!canonical)
    throw new BadRequestException(
      `Unsupported network for ${currency.toUpperCase()}: ${network.trim()}`,
    );
  return canonical;
}

export function resolveUpdatedMetadata(
  pmType: string,
  pmCurrency: string | null,
  pmMetadata: Record<string, unknown> | null | undefined,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return pmMetadata ?? undefined;
  if (pmType !== PaymentMethodType.CRYPTO && !isCryptoCurrency(pmCurrency ?? '')) return metadata;
  return {
    ...metadata,
    cryptoNetwork: assertAndCanonicalizeCryptoNetwork(pmCurrency ?? '', metadata.cryptoNetwork),
  };
}

export function buildNormalizedAccount(
  dtoType: PaymentMethodType | undefined,
  dtoCurrency: string,
  dtoWalletAddress: string | undefined,
  dtoAccountNumber: string | undefined,
): {
  rawAccount: string;
  normalizedAccount: string;
  normalizedBankCode: string | undefined;
  isCrypto: boolean;
} {
  const normalizedCurrency = dtoCurrency.toUpperCase();
  const isCryptoMethod =
    dtoType === PaymentMethodType.CRYPTO || isCryptoCurrency(normalizedCurrency);
  const rawAccount = isCryptoMethod
    ? (dtoWalletAddress ?? dtoAccountNumber ?? '')
    : (dtoAccountNumber ?? '');
  if (dtoType !== PaymentMethodType.CRYPTO && !isCryptoCurrency(normalizedCurrency))
    validateGlobalBankFields(normalizedCurrency, rawAccount, undefined);
  const normalizedAccount = isCryptoMethod
    ? rawAccount.trim()
    : normalizeAccountNumber(normalizedCurrency, rawAccount);
  return { rawAccount, normalizedAccount, normalizedBankCode: undefined, isCrypto: isCryptoMethod };
}
