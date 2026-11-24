import { UtilityLookupDto } from './utility-lookup.dto';
import { failedProperties, validationErrors } from './validate-dto.testing';

const valid = { countryCode: 'NG', billerId: 'ikeja-electric', accountNumber: '1234567890' };

describe('UtilityLookupDto', () => {
  it('accepts a valid lookup', () => {
    expect(validationErrors(UtilityLookupDto, { ...valid, serviceType: 'PREPAID' })).toHaveLength(
      0,
    );
  });

  it('rejects unknown fields', () => {
    expect(failedProperties(UtilityLookupDto, { ...valid, extra: 1 })).toContain('extra');
  });

  it('rejects missing and wrong-typed fields', () => {
    expect(failedProperties(UtilityLookupDto, { countryCode: 5 })).toEqual(
      expect.arrayContaining(['countryCode', 'billerId', 'accountNumber']),
    );
  });

  it('rejects an unknown serviceType', () => {
    expect(failedProperties(UtilityLookupDto, { ...valid, serviceType: 'X' })).toContain(
      'serviceType',
    );
  });
});
