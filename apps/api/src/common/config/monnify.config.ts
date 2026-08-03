export const MONNIFY_PRODUCTION_BASE_URL = 'https://api.monnify.com';
export const MONNIFY_SANDBOX_BASE_URL = 'https://sandbox.monnify.com';

export function isMonnifyLive(): boolean {
  return process.env.MONNIFY_LIVE === 'true';
}

export function getMonnifyBaseUrl(): string {
  const explicit = process.env.MONNIFY_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
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
