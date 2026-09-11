import { BadRequestException } from '@nestjs/common';

const GLOBAL_BANK_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);

export function requiresGlobalInstitutionCode(currency: string): boolean {
  return GLOBAL_BANK_CURRENCIES.has(currency.toUpperCase());
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

export function validateGlobalBankFields(
  currency: string,
  accountNumber: string,
  bankCode?: string | null,
): void {
  const code = currency.toUpperCase();
  if (!GLOBAL_BANK_CURRENCIES.has(code)) return;

  const institution = (bankCode ?? '').trim();
  const account = accountNumber.trim();

  switch (code) {
    case 'USD':
      if (!institution) {
        throw new BadRequestException('Routing number is required for USD payroll accounts');
      }
      if (!/^\d{9}$/.test(institution.replace(/\D/g, ''))) {
        throw new BadRequestException('Routing number must be exactly 9 digits');
      }
      if (!/^\d{4,17}$/.test(account.replace(/\D/g, ''))) {
        throw new BadRequestException('Account number must be 4–17 digits');
      }
      break;
    case 'EUR': {
      if (!institution) {
        throw new BadRequestException('BIC / SWIFT is required for EUR payroll accounts');
      }
      const iban = account.replace(/\s/g, '').toUpperCase();
      if (iban.length < 15 || iban.length > 34) {
        throw new BadRequestException('IBAN must be 15–34 characters');
      }
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
        throw new BadRequestException('IBAN format looks invalid');
      }
      const bic = institution.replace(/\s/g, '').toUpperCase();
      if (bic.length !== 8 && bic.length !== 11) {
        throw new BadRequestException('BIC / SWIFT must be 8 or 11 characters');
      }
      break;
    }
    case 'GBP': {
      const ukIban = parseUkIban(account);
      const sortCode = (institution.replace(/\D/g, '') || ukIban?.sortCode || '').trim();
      if (!sortCode) {
        throw new BadRequestException(
          'Sort code is required for GBP payroll accounts (or paste a full UK IBAN)',
        );
      }
      if (!/^\d{6}$/.test(sortCode)) {
        throw new BadRequestException('Sort code must be exactly 6 digits');
      }
      if (ukIban) break;
      const digits = account.replace(/\D/g, '');
      if (!/^\d{6,8}$/.test(digits)) {
        throw new BadRequestException('Enter an 8-digit UK account number or a full GB IBAN');
      }
      break;
    }
  }
}

export function normalizeAccountNumber(currency: string, accountNumber: string): string {
  const code = currency.toUpperCase();
  const trimmed = accountNumber.trim();
  if (code === 'EUR' || code === 'GBP') {
    return trimmed.replace(/\s/g, '').toUpperCase();
  }
  return trimmed.replace(/\D/g, '');
}

export function normalizeInstitutionCode(currency: string, bankCode: string): string {
  const code = currency.toUpperCase();
  const trimmed = bankCode.trim();
  if (code === 'EUR') {
    return trimmed.replace(/\s/g, '').toUpperCase();
  }
  // USD routing / GBP sort code — digits only
  return trimmed.replace(/\D/g, '');
}
