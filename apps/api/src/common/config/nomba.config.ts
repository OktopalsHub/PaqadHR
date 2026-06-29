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
  return (process.env.NOMBA_WEBHOOK_SIGNATURE_KEY || getNombaClientSecret()).trim();
}

export function getNombaPayoutAuthCode(): string {
  return (process.env.NOMBA_PAYOUT_AUTH_CODE || '').trim();
}

export function getNombaSenderName(): string {
  return (process.env.NOMBA_SENDER_NAME || 'PAQAD HR').trim();
}

export function isNombaConfigured(): boolean {
  return !!(getNombaClientId() && getNombaClientSecret() && getNombaAccountId());
}
