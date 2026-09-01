import { randomBytes } from 'node:crypto';
import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';

export type WalletTopupOrderRefProvider =
  | PaymentProvider.MONNIFY
  | PaymentProvider.NOMBA
  | PaymentProvider.NOAH
  | PaymentProvider.BACHS
  | PaymentProvider.FINCRA;

const WALLET_TOPUP_ORDER_REF_PREFIX: Record<WalletTopupOrderRefProvider, string> = {
  [PaymentProvider.MONNIFY]: 'wm',
  [PaymentProvider.NOMBA]: 'wt',
  [PaymentProvider.NOAH]: 'nw',
  [PaymentProvider.BACHS]: 'wb',
  [PaymentProvider.FINCRA]: 'wf',
};

/** Provider-specific merchant-reference limits (checkout DTO / gateway caps). */
const WALLET_TOPUP_ORDER_REF_MAX_LENGTH: Record<WalletTopupOrderRefProvider, number> = {
  [PaymentProvider.NOMBA]: 50,
  [PaymentProvider.MONNIFY]: 80,
  [PaymentProvider.NOAH]: 80,
  [PaymentProvider.BACHS]: 80,
  [PaymentProvider.FINCRA]: 80,
};

const TARGET_ENTROPY_BITS = 64;

function tenantKeyFromId(tenantId: string): string {
  return tenantId.replace(/-/g, '');
}

function uuidFromHex32(hex: string): string {
  const normalized = hex.toLowerCase();
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

/** Build a wallet top-up order reference with rail prefix, tenant id, timestamp, and max-fit entropy. */
export function buildWalletTopupOrderRef(
  provider: WalletTopupOrderRefProvider,
  tenantId: string,
): string {
  const prefix = WALLET_TOPUP_ORDER_REF_PREFIX[provider];
  const maxLength = WALLET_TOPUP_ORDER_REF_MAX_LENGTH[provider];
  const tenantKey = tenantKeyFromId(tenantId);
  const base = `${prefix}_${tenantKey}_`;
  const timestamp = Date.now().toString(36);
  const suffixBudget = maxLength - base.length - timestamp.length;
  const targetHexChars = TARGET_ENTROPY_BITS / 4;
  const hexChars = Math.max(0, Math.min(targetHexChars, suffixBudget));
  const randomHex = randomBytes(Math.ceil(hexChars / 2))
    .toString('hex')
    .slice(0, hexChars);
  const ref = `${base}${timestamp}${randomHex}`;
  if (ref.length > maxLength) {
    throw new Error(`Wallet top-up order reference exceeds ${maxLength} chars for ${provider}`);
  }
  return ref;
}

function matchesWalletTopupOrderRef(
  orderReference: string,
  tenantId: string,
  provider: WalletTopupOrderRefProvider,
): boolean {
  const prefix = WALLET_TOPUP_ORDER_REF_PREFIX[provider];
  return orderReference.startsWith(`${prefix}_${tenantKeyFromId(tenantId)}_`);
}

export function isMonnifyWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  return matchesWalletTopupOrderRef(orderReference, tenantId, PaymentProvider.MONNIFY);
}

export function isNombaWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  return matchesWalletTopupOrderRef(orderReference, tenantId, PaymentProvider.NOMBA);
}

export function isNoahWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  return matchesWalletTopupOrderRef(orderReference, tenantId, PaymentProvider.NOAH);
}

export function isBachsWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  return matchesWalletTopupOrderRef(orderReference, tenantId, PaymentProvider.BACHS);
}

export function isFincraWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  return matchesWalletTopupOrderRef(orderReference, tenantId, PaymentProvider.FINCRA);
}

/** Recover tenant UUID from `{prefix}_{uuidNoHyphens}_…` when webhook meta is missing. */
export function parseTenantIdFromWalletTopupOrderRef(orderReference: string): string | null {
  const match = /^(wm|wt|nw|wb|wf)_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  return uuidFromHex32(match[2]);
}

/** Recover tenant UUID from `wm_{uuidNoHyphens}_…` when webhook meta is missing. */
export function parseTenantIdFromMonnifyWalletTopupOrderRef(orderReference: string): string | null {
  const match = /^wm_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  return uuidFromHex32(match[1]);
}

/** Recover tenant UUID from `wf_{uuidNoHyphens}_…` when webhook meta is missing. */
export function parseTenantIdFromFincraWalletTopupOrderRef(orderReference: string): string | null {
  const match = /^wf_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  return uuidFromHex32(match[1]);
}

/** Infer checkout rail from our order-reference prefix (wm_/wt_/nw_/wb_/wf_). */
export function resolveWalletTopupProviderFromOrderRef(
  orderReference: string,
  tenantId: string,
): WalletTopupOrderRefProvider | null {
  if (isMonnifyWalletTopupOrderRef(orderReference, tenantId)) return PaymentProvider.MONNIFY;
  if (isNombaWalletTopupOrderRef(orderReference, tenantId)) return PaymentProvider.NOMBA;
  if (isNoahWalletTopupOrderRef(orderReference, tenantId)) return PaymentProvider.NOAH;
  if (isBachsWalletTopupOrderRef(orderReference, tenantId)) return PaymentProvider.BACHS;
  if (isFincraWalletTopupOrderRef(orderReference, tenantId)) return PaymentProvider.FINCRA;
  return null;
}
