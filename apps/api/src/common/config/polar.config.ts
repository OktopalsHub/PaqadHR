export function getPolarAccessToken(): string {
  return (process.env.POLAR_ACCESS_TOKEN || '').trim();
}

export function getPolarWebhookSecret(): string {
  return (process.env.POLAR_WEBHOOK_SECRET || '').trim();
}

export function isPolarConfigured(): boolean {
  return Boolean(getPolarAccessToken());
}
