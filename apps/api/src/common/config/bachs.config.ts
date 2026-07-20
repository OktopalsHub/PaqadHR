export function getBachsSecretKey(): string {
  return (process.env.BACHS_SECRET_KEY || '').trim();
}

export function getBachsWebhookSecret(): string {
  return (process.env.BACHS_WEBHOOK_SECRET || '').trim();
}

export function getBachsBaseUrl(): string {
  const configured = (process.env.BACHS_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    return configured.startsWith('http') ? configured : `https://${configured}`;
  }

  const secretKey = getBachsSecretKey();
  return secretKey.startsWith('sk_sandbox_')
    ? 'https://sandbox-api.bachs.io'
    : 'https://api.bachs.io';
}

export function isBachsConfigured(): boolean {
  return Boolean(getBachsSecretKey());
}

export function resolveBachsEnvironment(): 'sandbox' | 'live' | null {
  const key = getBachsSecretKey();
  if (!key) return null;

  const base = getBachsBaseUrl().toLowerCase();
  if (base.includes('sandbox')) return 'sandbox';
  if (base.includes('api.bachs.io')) return 'live';

  return key.startsWith('sk_sandbox_') ? 'sandbox' : 'live';
}
