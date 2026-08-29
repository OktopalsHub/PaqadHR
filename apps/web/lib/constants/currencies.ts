export const SUPPORTED_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;
export const SUPPORTED_CRYPTO_CURRENCIES = ['USDT', 'USDC'] as const;
export const SUPPORTED_PAYROLL_CURRENCIES = [
  ...SUPPORTED_FIAT_CURRENCIES,
  ...SUPPORTED_CRYPTO_CURRENCIES,
] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];
export type SupportedCryptoCurrency = (typeof SUPPORTED_CRYPTO_CURRENCIES)[number];

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
