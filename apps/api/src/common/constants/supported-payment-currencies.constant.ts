import { SUPPORTED_CRYPTO_CURRENCIES } from './crypto-currencies.constant';
import { SUPPORTED_FIAT_CURRENCIES } from './supported-fiat-currencies.constant';

export const NOMBA_FIAT_CURRENCIES = ['NGN'] as const;

/** Fiat currencies handled by Noah (non-NGN). */
export const NOAH_FIAT_CURRENCIES = SUPPORTED_FIAT_CURRENCIES.filter((c) => c !== 'NGN');

export function getSupportedPaymentCurrencies(): string[] {
  return [...NOMBA_FIAT_CURRENCIES, ...NOAH_FIAT_CURRENCIES, ...SUPPORTED_CRYPTO_CURRENCIES];
}
