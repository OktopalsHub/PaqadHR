import { GeoLocationHelper, getDefaultFiatCurrencyForCountry } from './geo-location.util';

describe('GeoLocationHelper', () => {
  it('maps Africa/Lagos timezone to Nigeria', () => {
    expect(GeoLocationHelper.resolveCountryFromTimezone('Africa/Lagos')).toBe('NG');
  });

  it('falls back to Nigeria timezone when IP is localhost', async () => {
    const result = await GeoLocationHelper.resolveDetectedCountry({
      ip: '127.0.0.1',
      timezone: 'Africa/Lagos',
    });

    expect(result).toEqual({ countryCode: 'NG', detectionMethod: 'timezone' });
  });

  it('reads country from Cloudflare header', async () => {
    const result = await GeoLocationHelper.resolveDetectedCountry({
      ip: '127.0.0.1',
      headers: { 'cf-ipcountry': 'NG' },
    });

    expect(result).toEqual({ countryCode: 'NG', detectionMethod: 'header' });
  });

  it('resolveUserCountryCode prefers geoip lookup on public IP', async () => {
    await expect(GeoLocationHelper.resolveUserCountryCode({ ip: '8.8.8.8' })).resolves.toBe('US');
  });

  it('resolveUserCountryCode falls back to edge headers when geoip misses', async () => {
    await expect(
      GeoLocationHelper.resolveUserCountryCode({
        ip: '127.0.0.1',
        headers: { 'cf-ipcountry': 'NG' },
      }),
    ).resolves.toBe('NG');
  });

  it('resolveUserCountryCode never returns GLOBAL', async () => {
    await expect(GeoLocationHelper.resolveUserCountryCode({ ip: '127.0.0.1' })).resolves.toBeNull();
  });

  it('getCountryDefaults maps country to fiat currency', () => {
    expect(GeoLocationHelper.getCountryDefaults('NG')).toEqual({
      currency: 'NGN',
      timezone: 'Africa/Lagos',
    });
    expect(GeoLocationHelper.getCountryDefaults('GB')).toEqual({
      currency: 'GBP',
      timezone: 'UTC',
    });
    expect(GeoLocationHelper.getCountryDefaults('DE')).toEqual({
      currency: 'EUR',
      timezone: 'UTC',
    });
    expect(GeoLocationHelper.getCountryDefaults('US')).toEqual({
      currency: 'USD',
      timezone: 'UTC',
    });
  });

  it('getDefaultFiatCurrencyForCountry matches payroll defaults', () => {
    expect(getDefaultFiatCurrencyForCountry('NG')).toBe('NGN');
    expect(getDefaultFiatCurrencyForCountry('gb')).toBe('GBP');
    expect(getDefaultFiatCurrencyForCountry('DE')).toBe('EUR');
    expect(getDefaultFiatCurrencyForCountry('CA')).toBe('USD');
    expect(getDefaultFiatCurrencyForCountry(null)).toBe('USD');
  });
});
