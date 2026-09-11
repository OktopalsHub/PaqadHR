import {
  normalizeAccountNumber,
  normalizeInstitutionCode,
  parseUkIban,
  validateGlobalBankFields,
} from './global-bank-validation.util';

describe('global-bank-validation', () => {
  it('keeps GBP IBAN letters and extracts sort code', () => {
    const iban = 'GB29 NWBK 601613 31926819';
    expect(normalizeAccountNumber('GBP', iban)).toBe('GB29NWBK60161331926819');
    expect(parseUkIban(iban)?.sortCode).toBe('601613');
    expect(() => validateGlobalBankFields('GBP', iban, '')).not.toThrow();
    expect(() => validateGlobalBankFields('GBP', '31926819', '601613')).not.toThrow();
  });

  it('rejects digit-stripped fake GBP accounts', () => {
    expect(() => validateGlobalBankFields('GBP', '2960161331926819', '601613')).toThrow(
      /IBAN|account/i,
    );
  });

  it('normalizes EUR IBAN and BIC', () => {
    expect(normalizeAccountNumber('EUR', 'de89 3704 0044 0532 0130 00')).toBe(
      'DE89370400440532013000',
    );
    expect(normalizeInstitutionCode('EUR', 'coba deff')).toBe('COBADEFF');
  });

  it('keeps USD numeric-only', () => {
    expect(normalizeAccountNumber('USD', '12-3456-789')).toBe('123456789');
    expect(normalizeInstitutionCode('USD', '021-000-021')).toBe('021000021');
  });
});
