import { resolveTenantDefaultCurrency } from './tenant-currency.util';

describe('resolveTenantDefaultCurrency', () => {
  it('locks Nigerian workspaces to NGN even with a stale preferred currency', () => {
    expect(resolveTenantDefaultCurrency({ countryCode: 'NG', preferredCurrency: 'USD' })).toBe(
      'NGN',
    );
    expect(resolveTenantDefaultCurrency({ countryCode: 'ng', preferredCurrency: null })).toBe(
      'NGN',
    );
  });

  it('prefers an explicit supported preferred currency', () => {
    expect(resolveTenantDefaultCurrency({ countryCode: 'US', preferredCurrency: 'GBP' })).toBe(
      'GBP',
    );
  });

  it('falls back to the country default, never a hardcoded USD', () => {
    expect(resolveTenantDefaultCurrency({ countryCode: 'GB' })).toBe('GBP');
    expect(resolveTenantDefaultCurrency({ countryCode: 'DE' })).toBe('EUR');
    expect(resolveTenantDefaultCurrency({ countryCode: null })).toBe('USD');
  });

  it('ignores an unsupported preferred currency', () => {
    expect(resolveTenantDefaultCurrency({ countryCode: 'DE', preferredCurrency: 'KES' })).toBe(
      'EUR',
    );
  });
});
