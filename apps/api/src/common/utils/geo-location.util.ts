import geoip from 'fast-geoip';

const DEFAULT_COUNTRY = 'GLOBAL';

const EURO_COUNTRY_CODES = new Set([
  'AD',
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'ME',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  'SM',
  'VA',
  'XK',
]);

const GBP_COUNTRY_CODES = new Set(['GB', 'GG', 'IM', 'JE']);

export function getDefaultFiatCurrencyForCountry(countryCode?: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (!code || code === DEFAULT_COUNTRY) return 'USD';
  if (code === 'NG') return 'NGN';
  if (GBP_COUNTRY_CODES.has(code)) return 'GBP';
  if (EURO_COUNTRY_CODES.has(code)) return 'EUR';
  return 'USD';
}

export type GeoRequestContext = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
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
    if (code === 'NG') {
      return { currency: 'NGN', timezone: 'Africa/Lagos' };
    }
    return { currency: getDefaultFiatCurrencyForCountry(code), timezone: 'UTC' };
  }

  static toStoredCountryCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const upper = code.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(upper) ? upper : null;
  }

  /** ISO-3166 alpha-2 from geoip on client IP, with edge-header fallback — never GLOBAL. */
  static async resolveUserCountryCode(context: GeoRequestContext = {}): Promise<string | null> {
    const ip = GeoLocationHelper.resolveClientIp(context.headers ?? {}, undefined, context.ip);
    if (ip && !GeoLocationHelper.isPrivateIp(ip)) {
      try {
        const geo = await geoip.lookup(GeoLocationHelper.normalizeIp(ip));
        const fromGeoIp = GeoLocationHelper.toStoredCountryCode(geo?.country ?? null);
        if (fromGeoIp) {
          return fromGeoIp;
        }
      } catch {
        // fall through to edge headers
      }
    }

    if (context.headers) {
      return GeoLocationHelper.resolveCountryFromHeaders(context.headers);
    }

    return null;
  }

  static toPricingRegion(code: string | null | undefined): string {
    const stored = GeoLocationHelper.toStoredCountryCode(code);
    return stored ?? DEFAULT_COUNTRY;
  }

  /**
   * Normalizes a tenant's country code and preferred currency into the effective
   * values used for plan-price lookups.  Rules:
   *   - null / undefined / 'GLOBAL' → countryCode 'GLOBAL', currency 'USD'
   *   - 'NG'                         → countryCode 'NG',    currency 'NGN'
   *   - any other valid ISO-2 code   → countryCode <code>,  currency 'USD'
   *
   * The supplied `preferredCurrency` is ignored when it doesn't match the
   * expected currency for the resolved country (safety net against stale data).
   */
  static resolveEffectiveCountryAndCurrency(
    countryCode: string | null | undefined,
    preferredCurrency?: string | null,
  ): { countryCode: string; currency: string } {
    const code = GeoLocationHelper.toStoredCountryCode(countryCode) ?? DEFAULT_COUNTRY;

    if (code === 'NG') {
      return { countryCode: 'NG', currency: 'NGN' };
    }

    // Everything else (including GLOBAL) uses USD
    return { countryCode: code, currency: 'USD' };
  }

  /**
   * When a tenant's countryCode is null or 'GLOBAL', attempt to re-detect
   * the real country from the request IP / headers.  Returns the (possibly
   * updated) tenant-like object.  Non-destructive — only updates when the
   * current value is null or GLOBAL-equivalent.
   */
  static async autoFillCountryCode<
    T extends { countryCode: string | null; preferredCurrency: string | null },
  >(
    tenant: T,
    clientIp?: string | null,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<T> {
    const current = GeoLocationHelper.toStoredCountryCode(tenant.countryCode);
    if (current && current !== DEFAULT_COUNTRY) {
      return tenant;
    }

    const detected = await GeoLocationHelper.resolveDetectedCountry({
      ip: clientIp ?? undefined,
      stored: null,
      headers,
    });

    if (detected.countryCode && detected.countryCode !== DEFAULT_COUNTRY) {
      tenant.countryCode = detected.countryCode;
      const defaults = GeoLocationHelper.getCountryDefaults(detected.countryCode);
      tenant.preferredCurrency = defaults.currency;
    }

    return tenant;
  }
}
