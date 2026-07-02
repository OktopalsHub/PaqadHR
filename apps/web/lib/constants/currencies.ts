export const SUPPORTED_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];

export interface GeneralSettings {
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  payrollCurrencies?: string[];
  language?: string;
  companyName?: string;
  paginationLimit?: number;
  emailPayslipOnPublish?: boolean;
}
