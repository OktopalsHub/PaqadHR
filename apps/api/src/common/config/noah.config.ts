export type NoahEnvironment = 'sandbox' | 'production';

export function getNoahEnvironment(): NoahEnvironment {
  const env = (process.env.NOAH_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function getNoahApiKey(): string {
  return (process.env.NOAH_API_KEY || '').trim();
}

export function getNoahSigningPrivateKey(): string {
  return (process.env.NOAH_SIGNING_PRIVATE_KEY || '').trim();
}

export function getNoahWebhookSecret(): string {
  return (process.env.NOAH_WEBHOOK_SECRET || '').trim();
}

export function getNoahBaseUrl(): string {
  const override = process.env.NOAH_API_BASE_URL?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }
  return getNoahEnvironment() === 'production'
    ? 'https://api.noah.com/v1'
    : 'https://api.sandbox.noah.com/v1';
}

/** Default stablecoin used as Noah payout source for fiat payroll. */
export function getNoahPayoutCryptoCurrency(): string {
  return (process.env.NOAH_PAYOUT_CRYPTO_CURRENCY || 'USDC').toUpperCase();
}

export function isNoahConfigured(): boolean {
  return !!getNoahApiKey();
}

export function isNoahSigningRequired(): boolean {
  return getNoahEnvironment() === 'production' || !!getNoahSigningPrivateKey();
}
