export const FINCRA_PRODUCTION_BASE_URL = 'https://api.fincra.com';
export const FINCRA_SANDBOX_BASE_URL = 'https://sandboxapi.fincra.com';

export function isFincraLive(): boolean {
  return process.env.FINCRA_LIVE === 'true';
}

export function getFincraBaseUrl(): string {
  const explicit = process.env.FINCRA_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
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
  return (process.env.FINCRA_PAYOUT_SOURCE_CURRENCY || 'NGN').trim().toUpperCase();
}

export function isFincraConfigured(): boolean {
  return !!(getFincraApiKey() && getFincraBusinessId());
}

export function isFincraCheckoutConfigured(): boolean {
  return isFincraConfigured() && !!getFincraPublicKey();
}

/** Local dev only — never set in staging/production. */
export function isFincraAllowUnsignedWebhooks(): boolean {
  return process.env.FINCRA_ALLOW_UNSIGNED_WEBHOOKS === 'true';
}
