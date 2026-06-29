export function getReloadlyBaseUrl(): string {
  const sandbox = process.env.RELOADLY_SANDBOX === 'true';
  if (sandbox) {
    return 'https://giftcards-sandbox.reloadly.com';
  }
  return (process.env.RELOADLY_BASE_URL || 'https://giftcards.reloadly.com').replace(/\/$/, '');
}

export function getReloadlyAuthUrl(): string {
  return (process.env.RELOADLY_AUTH_URL || 'https://auth.reloadly.com/oauth/token').replace(
    /\/$/,
    '',
  );
}

export function getReloadlyClientId(): string {
  return (process.env.RELOADLY_CLIENT_ID || '').trim();
}

export function getReloadlyClientSecret(): string {
  return (process.env.RELOADLY_CLIENT_SECRET || '').trim();
}

export function isReloadlyConfigured(): boolean {
  return !!(getReloadlyClientId() && getReloadlyClientSecret());
}

export function isReloadlySandbox(): boolean {
  return process.env.RELOADLY_SANDBOX === 'true';
}
