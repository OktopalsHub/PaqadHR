export const BRIDGE_PRODUCTION_BASE_URL = 'https://api.bridge.xyz';

export function getBridgeBaseUrl(): string {
  const explicit = process.env.BRIDGE_BASE_URL?.trim();
  const baseUrl = explicit || BRIDGE_PRODUCTION_BASE_URL;
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error('BRIDGE_BASE_URL must use HTTPS.');
  }
  return baseUrl.replace(/\/$/, '');
}

export function getBridgeApiKey(): string {
  return (process.env.BRIDGE_API_KEY || '').trim();
}

export function getBridgeRequestTimeoutMs(): number {
  const configured = Number(process.env.BRIDGE_REQUEST_TIMEOUT_MS || 15000);
  return Number.isInteger(configured) && configured >= 1000 && configured <= 60000
    ? configured
    : 15000;
}

export function getBridgeWebhookPublicKey(): string {
  return (process.env.BRIDGE_WEBHOOK_PUBLIC_KEY || '').trim().replace(/\\n/g, '\n');
}

export function isBridgeConfigured(): boolean {
  return getBridgeApiKey().length > 0;
}

export function isBridgeDeveloperFeeCollectionEnabled(): boolean {
  return process.env.BRIDGE_DEVELOPER_FEE_COLLECTION_ENABLED?.trim().toLowerCase() === 'true';
}
