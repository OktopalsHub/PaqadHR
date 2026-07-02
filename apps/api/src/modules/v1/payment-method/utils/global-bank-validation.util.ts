import { BadRequestException } from '@nestjs/common';

const GLOBAL_BANK_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);

export function requiresGlobalInstitutionCode(currency: string): boolean {
  return GLOBAL_BANK_CURRENCIES.has(currency.toUpperCase());
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

  if (!institution) {
    const label = code === 'USD' ? 'Routing number' : code === 'EUR' ? 'BIC / SWIFT' : 'Sort code';
    throw new BadRequestException(`${label} is required for ${code} payroll accounts`);
  }

  switch (code) {
    case 'USD':
      if (!/^\d{9}$/.test(institution.replace(/\D/g, ''))) {
        throw new BadRequestException('Routing number must be exactly 9 digits');
      }
      if (!/^\d{4,17}$/.test(account.replace(/\D/g, ''))) {
        throw new BadRequestException('Account number must be 4–17 digits');
      }
      break;
    case 'EUR': {
      const iban = account.replace(/\s/g, '').toUpperCase();
      if (iban.length < 15 || iban.length > 34) {
        throw new BadRequestException('IBAN must be 15–34 characters');
      }
      const bic = institution.replace(/\s/g, '').toUpperCase();
      if (bic.length !== 8 && bic.length !== 11) {
        throw new BadRequestException('BIC / SWIFT must be 8 or 11 characters');
      }
      break;
    }
    case 'GBP':
      if (!/^\d{6}$/.test(institution.replace(/\D/g, ''))) {
        throw new BadRequestException('Sort code must be exactly 6 digits');
      }
      if (!/^\d{6,17}$/.test(account.replace(/\D/g, ''))) {
        throw new BadRequestException('Account number must be 6–17 digits');
      }
      break;
  }
}

export function normalizeAccountNumber(currency: string, accountNumber: string): string {
  const code = currency.toUpperCase();
  const trimmed = accountNumber.trim();
  if (code === 'EUR') {
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
  return trimmed.replace(/\D/g, '');
}
