export function getNombaBaseUrl(): string {
  return (process.env.NOMBA_BASE_URL || 'https://api.nomba.com').replace(/\/$/, '');
}

export function getNombaClientId(): string {
  return (process.env.NOMBA_CLIENT_ID || '').trim();
}

export function getNombaClientSecret(): string {
  return (process.env.NOMBA_CLIENT_SECRET || '').trim();
}

export function getNombaAccountId(): string {
  return (process.env.NOMBA_ACCOUNT_ID || '').trim();
}

export function getNombaWebhookSecret(): string {
  return (process.env.NOMBA_WEBHOOK_SIGNATURE_KEY || '').trim();
}

export function getNombaPayoutAuthCode(): string {
  return (process.env.NOMBA_PAYOUT_AUTH_CODE || '').trim();
}

const PLATFORM_NAME = 'PaqadHR';

export function formatNombaSenderName(tenantName?: string | null): string {
  const name = tenantName?.trim();
  return name ? `${name} via ${PLATFORM_NAME}` : PLATFORM_NAME;
}

export function isNombaConfigured(): boolean {
  return !!(getNombaClientId() && getNombaClientSecret() && getNombaAccountId());
}
