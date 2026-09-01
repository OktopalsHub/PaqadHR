export const FINCRA_PRODUCTION_BASE_URL = 'https://api.fincra.com';
export const FINCRA_SANDBOX_BASE_URL = 'https://sandboxapi.fincra.com';

const ALLOWED_FINCRA_HOSTS = new Set(['api.fincra.com', 'sandboxapi.fincra.com']);

export function isAllowedFincraBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_FINCRA_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isFincraLive(): boolean {
  return process.env.FINCRA_LIVE === 'true';
}

export function getFincraBaseUrl(): string {
  const explicit = process.env.FINCRA_BASE_URL?.trim();
  if (explicit) {
    const normalized = explicit.replace(/\/$/, '');
    if (!isAllowedFincraBaseUrl(normalized)) {
      throw new Error(
        'FINCRA_BASE_URL must use HTTPS and point to api.fincra.com or sandboxapi.fincra.com',
      );
    }
    return normalized;
  }
  return (isFincraLive() ? FINCRA_PRODUCTION_BASE_URL : FINCRA_SANDBOX_BASE_URL).replace(/\/$/, '');
}

export function getFincraApiKey(): string {
  return (process.env.FINCRA_API_KEY || '').trim();
}

export function getFincraPublicKey(): string {
  return (process.env.FINCRA_PUBLIC_KEY || '').trim();
}

export function getFincraBusinessId(): string {
  return (process.env.FINCRA_BUSINESS_ID || '').trim();
}

export function getFincraWebhookSecret(): string {
  return (process.env.FINCRA_WEBHOOK_SECRET || '').trim();
}

export function getFincraPayoutSourceCurrency(): string {
  const explicit = process.env.FINCRA_PAYOUT_SOURCE_CURRENCY?.trim();
  if (explicit) {
    return explicit.toUpperCase();
  }
  return 'NGN';
}

/** Map Fincra business country to default payout wallet currency when env override is unset. */
export function mapFincraCountryToSourceCurrency(country?: string | null): string {
  const code = (country ?? 'NG').trim().toUpperCase();
  const byCountry: Record<string, string> = {
    NG: 'NGN',
    US: 'USD',
    GB: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    NL: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
  };
  return byCountry[code] ?? 'NGN';
}

export function isFincraConfigured(): boolean {
  return !!getFincraApiKey();
}

export function isFincraCheckoutConfigured(): boolean {
  return !!getFincraApiKey() && !!getFincraPublicKey();
}
