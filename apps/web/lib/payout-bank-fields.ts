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
  institutionAlphanumeric: boolean;
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
    institutionAlphanumeric: false,
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
    institutionAlphanumeric: true,
  },
  GBP: {
    accountLabel: 'IBAN or account number',
    accountPlaceholder: 'GB29NWBK60161331926819 or 8-digit account',
    institutionLabel: 'Sort code',
    institutionPlaceholder: '6 digits, e.g. 601613',
    help: 'GBP uses Faster Payments. Paste a UK IBAN (sort code is filled automatically) or enter an 8-digit account + 6-digit sort code.',
    accountMaxLength: 34,
    institutionMaxLength: 6,
    accountAlphanumeric: true,
    institutionAlphanumeric: false,
  },
};

export function getPayoutFieldConfig(currency: string): PayoutFieldConfig | null {
  const code = currency.toUpperCase();
  if (!isGlobalBankCurrency(code)) return null;
  return CONFIG[code];
}

/** UK IBAN: GB + check(2) + bank(4) + sort(6) + account(8) = 22 chars. */
export function parseUkIban(
  value: string,
): { iban: string; sortCode: string; accountNumber: string } | null {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^GB\d{2}[A-Z]{4}\d{14}$/.test(iban)) return null;
  return {
    iban,
    sortCode: iban.slice(8, 14),
    accountNumber: iban.slice(14, 22),
  };
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
  if (config.institutionAlphanumeric) {
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
  let institution = normalizeInstitutionInput(institutionCode, config);

  if (!account) return `${config.accountLabel} is required`;

  switch (currency.toUpperCase()) {
    case 'USD':
      if (!institution) return `${config.institutionLabel} is required`;
      if (institution.length !== 9) return 'Routing number must be 9 digits';
      if (account.length < 4) return 'Account number is too short';
      return null;
    case 'EUR':
      if (!institution) return `${config.institutionLabel} is required`;
      if (account.length < 15 || account.length > 34) return 'IBAN must be 15–34 characters';
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(account)) return 'IBAN format looks invalid';
      if (institution.length !== 8 && institution.length !== 11) {
        return 'BIC / SWIFT must be 8 or 11 characters';
      }
      return null;
    case 'GBP': {
      const ukIban = parseUkIban(account);
      if (ukIban) {
        institution = institution || ukIban.sortCode;
      }
      if (!institution) return 'Sort code is required (or paste a full UK IBAN)';
      if (institution.length !== 6) return 'Sort code must be 6 digits';
      if (ukIban) return null;
      // Domestic Faster Payments: typically 8-digit account number
      if (!/^\d{6,8}$/.test(account)) {
        return 'Enter an 8-digit UK account number or a full GB IBAN';
      }
      return null;
    }
    default:
      return null;
  }
}
