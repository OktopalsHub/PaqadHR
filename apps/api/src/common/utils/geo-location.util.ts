import geoip from 'fast-geoip';

const DEFAULT_COUNTRY = 'GLOBAL';

/** Minimal billing defaults — plan_prices carry regional_config; this is tenant bootstrap only. */
const COUNTRY_DEFAULTS: Record<string, { currency: string; timezone: string }> = {
  NG: { currency: 'NGN', timezone: 'Africa/Lagos' },
  GLOBAL: { currency: 'USD', timezone: 'UTC' },
};

export class GeoLocationHelper {
  static isPrivateIp(ip: string): boolean {
    if (!ip || ip === 'localhost') return true;
    const normalized = this.normalizeIp(ip);
    return (
      normalized === '127.0.0.1' ||
      normalized.startsWith('10.') ||
      normalized.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    );
  }

  /** @deprecated use isPrivateIp */
  static isLocalhost(ip: string): boolean {
    return this.isPrivateIp(ip);
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
    const pick = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v[0] : v;

    const raw =
      pick(cf) ||
      pick(realIp) ||
      (pick(forwarded)?.split(',')[0]?.trim()) ||
      reqIp ||
      socketRemoteAddress ||
      '127.0.0.1';

    return this.normalizeIp(raw);
  }

  static async getCountryCode(ip: string): Promise<string> {
    const normalized = this.normalizeIp(ip);
    if (this.isPrivateIp(normalized)) {
      return DEFAULT_COUNTRY;
    }
    try {
      const geo = await geoip.lookup(normalized);
      return geo?.country || DEFAULT_COUNTRY;
    } catch {
      return DEFAULT_COUNTRY;
    }
  }

  static async resolveCountryCode(options: {
    ip?: string;
    stored?: string | null;
  }): Promise<string> {
    if (options.stored) return options.stored.toUpperCase();
    if (options.ip) return this.getCountryCode(options.ip);
    return DEFAULT_COUNTRY;
  }

  static getCountryDefaults(countryCode: string): {
    currency: string;
    timezone: string;
  } {
    const code = countryCode?.toUpperCase() || DEFAULT_COUNTRY;
    return COUNTRY_DEFAULTS[code] ?? COUNTRY_DEFAULTS.GLOBAL;
  }
}
