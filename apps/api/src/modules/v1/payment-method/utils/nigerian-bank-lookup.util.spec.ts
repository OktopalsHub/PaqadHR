import {
  mergeBankLogos,
  monnifyBankCodesToTry,
  nombaBankCodesToTry,
  shouldPreferMonnifyForBankLookup,
} from './nigerian-bank-lookup.util';

describe('nigerian-bank-lookup.util', () => {
  it('maps Opay NIP code to Monnify Paycom code and leaves PalmPay unchanged', () => {
    expect(monnifyBankCodesToTry('100004')).toEqual(['999992', '100004']);
    expect(monnifyBankCodesToTry('100033')).toEqual(['100033']);
    expect(monnifyBankCodesToTry('999992')).toEqual(['999992']);
    expect(nombaBankCodesToTry('999992')).toEqual(['100004', '999992']);
    expect(nombaBankCodesToTry('100033')).toEqual(['100033']);
  });

  it('prefers Monnify whenever it is configured', () => {
    expect(shouldPreferMonnifyForBankLookup({ monnifyConfigured: true })).toBe(true);
    expect(shouldPreferMonnifyForBankLookup({ monnifyConfigured: false })).toBe(false);
  });

  it('merges Nomba logos onto Monnify bank rows by code alias and name', () => {
    const merged = mergeBankLogos(
      [
        { code: '999992', name: 'PAYCOM (OPAY)' },
        { code: '100033', name: 'PALMPAY' },
        { code: '058', name: 'GTBank' },
      ],
      [
        { code: '100004', name: 'Opay', logoUrl: 'https://cdn.example/opay.png' },
        { code: '100033', name: 'PalmPay', logoUrl: 'https://cdn.example/palmpay.png' },
        { code: '058', name: 'Guaranty Trust Bank', logoUrl: 'https://cdn.example/gtb.png' },
      ],
    );
    expect(merged[0].logoUrl).toBe('https://cdn.example/opay.png');
    expect(merged[1].logoUrl).toBe('https://cdn.example/palmpay.png');
    expect(merged[2].logoUrl).toBe('https://cdn.example/gtb.png');
  });
});
