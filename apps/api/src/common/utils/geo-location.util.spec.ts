import { GeoLocationHelper } from './geo-location.util';

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
});
