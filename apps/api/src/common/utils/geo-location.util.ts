import geoip from 'fast-geoip';

const DEFAULT_COUNTRY = 'GLOBAL';

const COUNTRY_DEFAULTS: Record<string, { currency: string; timezone: string }> = {
  NG: { currency: 'NGN', timezone: 'Africa/Lagos' },
  GLOBAL: { currency: 'USD', timezone: 'UTC' },
};

export class GeoLocationHelper {
  static isPrivateIp(ip: string): boolean {
    if (!ip || ip === 'localhost') return true;
    const normalized = GeoLocationHelper.normalizeIp(ip);
    return (
      normalized === '127.0.0.1' ||
      normalized.startsWith('10.') ||
      normalized.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    );
  }

  static isLocalhost(ip: string): boolean {
    return GeoLocationHelper.isPrivateIp(ip);
  }

  static normalizeIp(ip: string): string {
    if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
  }

  static resolveClientIp(
    headers: Record<string, string | string[] | undefined>,
    socketRemoteAddress?: string,
    reqIp?: string,
  ): string {
    const cf = headers['cf-connecting-ip'];
    const realIp = headers['x-real-ip'];
    const forwarded = headers['x-forwarded-for'];
    const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

    const raw =
      pick(cf) ||
      pick(realIp) ||
      pick(forwarded)?.split(',')[0]?.trim() ||
      reqIp ||
      socketRemoteAddress ||
      '127.0.0.1';

    return GeoLocationHelper.normalizeIp(raw);
  }

  static async getCountryCode(ip: string): Promise<string> {
    const normalized = GeoLocationHelper.normalizeIp(ip);
    if (GeoLocationHelper.isPrivateIp(normalized)) {
      return DEFAULT_COUNTRY;
    }
    try {
      const geo = await geoip.lookup(normalized);
      return geo?.country || DEFAULT_COUNTRY;
    } catch {
      return DEFAULT_COUNTRY;
    }
  }

  static resolveCountryFromHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const candidates = [
      pick(headers['cf-ipcountry']),
      pick(headers['x-vercel-ip-country']),
      pick(headers['cloudfront-viewer-country']),
    ];

    for (const code of candidates) {
      if (!code || code === 'XX') continue;
      const upper = code.toUpperCase();
      if (/^[A-Z]{2}$/.test(upper)) return upper;
    }

    return null;
  }

  static resolveCountryFromTimezone(timezone?: string | null): string | null {
    if (!timezone) return null;
    const normalized = timezone.trim();
    if (normalized === 'Africa/Lagos') return 'NG';
    return null;
  }

  static async resolveDetectedCountry(options: {
    ip?: string;
    stored?: string | null;
    headers?: Record<string, string | string[] | undefined>;
    timezone?: string | null;
  }): Promise<{ countryCode: string; detectionMethod: string }> {
    if (options.stored) {
      return { countryCode: options.stored.toUpperCase(), detectionMethod: 'stored' };
    }

    const fromHeaders = options.headers
      ? GeoLocationHelper.resolveCountryFromHeaders(options.headers)
      : null;
    if (fromHeaders) {
      return { countryCode: fromHeaders, detectionMethod: 'header' };
    }

    if (options.ip) {
      const fromIp = await GeoLocationHelper.getCountryCode(options.ip);
      if (fromIp !== DEFAULT_COUNTRY) {
        return { countryCode: fromIp, detectionMethod: 'ip' };
      }
    }

    const fromTimezone = GeoLocationHelper.resolveCountryFromTimezone(options.timezone);
    if (fromTimezone) {
      return { countryCode: fromTimezone, detectionMethod: 'timezone' };
    }

    return { countryCode: DEFAULT_COUNTRY, detectionMethod: 'default' };
  }

  static async resolveCountryCode(options: {
    ip?: string;
    stored?: string | null;
    headers?: Record<string, string | string[] | undefined>;
    timezone?: string | null;
  }): Promise<string> {
    const { countryCode } = await GeoLocationHelper.resolveDetectedCountry(options);
    return countryCode;
  }

  static getCountryDefaults(countryCode: string): {
    currency: string;
    timezone: string;
  } {
    const code = countryCode?.toUpperCase() || DEFAULT_COUNTRY;
    return COUNTRY_DEFAULTS[code] ?? COUNTRY_DEFAULTS.GLOBAL;
  }

  static toStoredCountryCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const upper = code.toUpperCase();
    return /^[A-Z]{2}$/.test(upper) ? upper : null;
  }

  static toPricingRegion(code: string | null | undefined): string {
    const stored = GeoLocationHelper.toStoredCountryCode(code);
    return stored ?? DEFAULT_COUNTRY;
  }
}
