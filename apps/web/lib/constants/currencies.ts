export const SUPPORTED_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;
/** Stablecoins only — Bachs is the sole crypto rail and delivers USDT/USDC. */
export const SUPPORTED_CRYPTO_CURRENCIES = ['USDT', 'USDC'] as const;
export const SUPPORTED_PAYROLL_CURRENCIES = [
  ...SUPPORTED_FIAT_CURRENCIES,
  ...SUPPORTED_CRYPTO_CURRENCIES,
] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];
export type SupportedCryptoCurrency = (typeof SUPPORTED_CRYPTO_CURRENCIES)[number];

/** Bachs delivery networks per stablecoin (USDT on TRC20/BEP20/ERC20/SOL, USDC on BEP20/ERC20/SOL/BASE). */
export const CRYPTO_NETWORKS_BY_CURRENCY: Record<SupportedCryptoCurrency, readonly string[]> = {
  USDC: ['Ethereum', 'Base', 'PolygonPos', 'Solana', 'Celo', 'Gnosis', 'FlowEvm'],
  // TRC20/BEP20 are delivered by Bachs and only accepted when the Bachs USDT rail is enabled.
  USDT: ['Ethereum', 'TRC20', 'BEP20'],
};

export function isCryptoCurrency(code: string): boolean {
  return SUPPORTED_CRYPTO_CURRENCIES.includes(
    code.toUpperCase() as (typeof SUPPORTED_CRYPTO_CURRENCIES)[number],
  );
}

export function networksForCryptoCurrency(currency: string): readonly string[] {
  const code = currency.toUpperCase() as SupportedCryptoCurrency;
  return CRYPTO_NETWORKS_BY_CURRENCY[code] ?? [];
}

export interface GeneralSettings {
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  payrollCurrencies?: string[];
  cryptoEnabled?: boolean;
  language?: string;
  companyName?: string;
  paginationLimit?: number;
  emailPayslipOnPublish?: boolean;
}
