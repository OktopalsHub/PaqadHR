export const MONNIFY_PRODUCTION_BASE_URL = 'https://api.monnify.com';
export const MONNIFY_SANDBOX_BASE_URL = 'https://sandbox.monnify.com';

const ALLOWED_MONNIFY_HOSTS = new Set(['api.monnify.com', 'sandbox.monnify.com']);

export function isAllowedMonnifyBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_MONNIFY_HOSTS.has(parsed.hostname.toLowerCase())) return false;
    // Origin only: reject path, query, fragment, credentials, and non-default ports.
    if (parsed.username || parsed.password) return false;
    if (parsed.port) return false;
    if (parsed.pathname !== '/' && parsed.pathname !== '') return false;
    if (parsed.search || parsed.hash) return false;
    return true;
  } catch {
    return false;
  }
}

export function isMonnifyLive(): boolean {
  return process.env.MONNIFY_LIVE === 'true';
}

export function getMonnifyBaseUrl(): string {
  const explicit = process.env.MONNIFY_BASE_URL?.trim();
  if (explicit) {
    const normalized = explicit.replace(/\/$/, '');
    if (!isAllowedMonnifyBaseUrl(normalized)) {
      throw new Error(
        'MONNIFY_BASE_URL must use HTTPS and point to api.monnify.com or sandbox.monnify.com',
      );
    }
    return normalized;
  }
  return (isMonnifyLive() ? MONNIFY_PRODUCTION_BASE_URL : MONNIFY_SANDBOX_BASE_URL).replace(
    /\/$/,
    '',
  );
}

export function getMonnifyApiKey(): string {
  return (process.env.MONNIFY_API_KEY || '').trim();
}

export function getMonnifySecretKey(): string {
  return (process.env.MONNIFY_SECRET_KEY || '').trim();
}

export function getMonnifyWebhookSecret(): string {
  return (process.env.MONNIFY_WEBHOOK_SECRET || getMonnifySecretKey()).trim();
}

export function getMonnifyContractCode(): string {
  return (process.env.MONNIFY_CONTRACT_CODE || '').trim();
}

export function getMonnifyWalletAccountNumber(): string {
  return (process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || '').trim();
}

export function isMonnifyConfigured(): boolean {
  return !!(getMonnifyApiKey() && getMonnifySecretKey() && getMonnifyContractCode());
}
