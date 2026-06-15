import type { PaymentProvider } from 'src/common/enums';

export interface CurrencyValidationResult {
  isValid: boolean;
  currency?: string;
  supportedProviders: PaymentProvider[];
  errors: string[];
  warnings: string[];
}
