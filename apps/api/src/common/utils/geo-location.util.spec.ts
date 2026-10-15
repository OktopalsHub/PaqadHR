import { GeoLocationHelper, getDefaultFiatCurrencyForCountry } from './geo-location.util';

describe('GeoLocationHelper', () => {
  const originalTrust = process.env.TRUST_PROXY_HEADERS;

  afterEach(() => {
    if (originalTrust === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = originalTrust;
    }
  });

  it('maps Africa/Lagos timezone to Nigeria', () => {
    expect(GeoLocationHelper.resolveCountryFromTimezone('Africa/Lagos')).toBe('NG');
  });

  it('ignores spoofed forwarding headers from a direct public peer', () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(
      GeoLocationHelper.resolveClientIp(
        {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '1.2.3.4',
        },
        '203.0.113.50',
        '1.2.3.4',
      ),
    ).toBe('203.0.113.50');
  });

  it('trusts forwarding headers behind a private proxy hop', () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(
      GeoLocationHelper.resolveClientIp(
        { 'cf-connecting-ip': '198.51.100.10' },
        '10.0.0.2',
        '10.0.0.2',
      ),
    ).toBe('198.51.100.10');
  });

  it('trusts forwarding headers when TRUST_PROXY_HEADERS=true', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    expect(
      GeoLocationHelper.resolveClientIp(
        { 'x-forwarded-for': '198.51.100.20' },
        '203.0.113.50',
        '203.0.113.50',
      ),
    ).toBe('198.51.100.20');
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
