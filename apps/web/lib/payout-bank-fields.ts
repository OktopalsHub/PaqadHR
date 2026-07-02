export const GLOBAL_BANK_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

export type GlobalBankCurrency = (typeof GLOBAL_BANK_CURRENCIES)[number];

export function isGlobalBankCurrency(currency: string): currency is GlobalBankCurrency {
  return GLOBAL_BANK_CURRENCIES.includes(currency.toUpperCase() as GlobalBankCurrency);
}

export type PayoutFieldConfig = {
  accountLabel: string;
  accountPlaceholder: string;
  institutionLabel: string;
  institutionPlaceholder: string;
  help: string;
  accountMaxLength: number;
  institutionMaxLength: number;
  accountAlphanumeric: boolean;
};

const CONFIG: Record<GlobalBankCurrency, PayoutFieldConfig> = {
  USD: {
    accountLabel: 'Account number',
    accountPlaceholder: 'Checking account number',
    institutionLabel: 'Routing number (ACH)',
    institutionPlaceholder: '9-digit routing number',
    help: 'USD payroll is sent via ACH. An admin must verify your account before the first payout.',
    accountMaxLength: 17,
    institutionMaxLength: 9,
    accountAlphanumeric: false,
  },
  EUR: {
    accountLabel: 'IBAN',
    accountPlaceholder: 'DE89370400440532013000',
    institutionLabel: 'BIC / SWIFT',
    institutionPlaceholder: '8 or 11 characters',
    help: 'EUR payroll is sent via SEPA. Enter your IBAN and bank BIC. An admin must verify before payout.',
    accountMaxLength: 34,
    institutionMaxLength: 11,
    accountAlphanumeric: true,
  },
  GBP: {
    accountLabel: 'Account number',
    accountPlaceholder: '8-digit account number',
    institutionLabel: 'Sort code',
    institutionPlaceholder: '6 digits, e.g. 040004',
    help: 'GBP payroll uses Faster Payments. An admin must verify your account before the first payout.',
    accountMaxLength: 17,
    institutionMaxLength: 6,
    accountAlphanumeric: false,
  },
};

export function getPayoutFieldConfig(currency: string): PayoutFieldConfig | null {
  const code = currency.toUpperCase();
  if (!isGlobalBankCurrency(code)) return null;
  return CONFIG[code];
}

export function normalizeAccountInput(value: string, config: PayoutFieldConfig): string {
  const trimmed = value.trim();
  if (config.accountAlphanumeric) {
    return trimmed.replace(/\s/g, '').toUpperCase().slice(0, config.accountMaxLength);
  }
  return trimmed.replace(/\D/g, '').slice(0, config.accountMaxLength);
}

export function normalizeInstitutionInput(value: string, config: PayoutFieldConfig): string {
  const trimmed = value.trim();
  if (config.accountAlphanumeric) {
    return trimmed.replace(/\s/g, '').toUpperCase().slice(0, config.institutionMaxLength);
  }
  return trimmed.replace(/\D/g, '').slice(0, config.institutionMaxLength);
}

export function validateGlobalBankFields(
  currency: string,
  accountNumber: string,
  institutionCode: string,
): string | null {
  const config = getPayoutFieldConfig(currency);
  if (!config) return null;

  const account = normalizeAccountInput(accountNumber, config);
  const institution = normalizeInstitutionInput(institutionCode, config);

  if (!account) return `${config.accountLabel} is required`;
  if (!institution) return `${config.institutionLabel} is required`;

  switch (currency.toUpperCase()) {
    case 'USD':
      if (institution.length !== 9) return 'Routing number must be 9 digits';
      if (account.length < 4) return 'Account number is too short';
      return null;
    case 'EUR':
      if (account.length < 15) return 'IBAN looks too short';
      if (institution.length !== 8 && institution.length !== 11) {
        return 'BIC / SWIFT must be 8 or 11 characters';
      }
      return null;
    case 'GBP':
      if (institution.length !== 6) return 'Sort code must be 6 digits';
      if (account.length < 6) return 'Account number is too short';
      return null;
    default:
      return null;
  }
}
