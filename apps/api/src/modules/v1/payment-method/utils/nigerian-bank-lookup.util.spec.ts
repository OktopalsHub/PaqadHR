import {
  monnifyBankCodesToTry,
  shouldPreferMonnifyForBankLookup,
} from './nigerian-bank-lookup.util';

describe('nigerian-bank-lookup.util', () => {
  it('maps Opay/Paycom and PalmPay NIP codes to Monnify codes first', () => {
    expect(monnifyBankCodesToTry('100004')).toEqual(['999992', '100004']);
    expect(monnifyBankCodesToTry('100033')).toEqual(['999991', '100033']);
    expect(monnifyBankCodesToTry('999992')).toEqual(['999992', '100004']);
    expect(monnifyBankCodesToTry('058')).toEqual(['058']);
  });

  it('prefers Monnify for lookups when Nomba is sandbox', () => {
    expect(shouldPreferMonnifyForBankLookup({ monnifyConfigured: true, nombaLive: false })).toBe(
      true,
    );
    expect(shouldPreferMonnifyForBankLookup({ monnifyConfigured: true, nombaLive: true })).toBe(
      false,
    );
    expect(shouldPreferMonnifyForBankLookup({ monnifyConfigured: false, nombaLive: false })).toBe(
      false,
    );
  });
});
