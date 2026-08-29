import { randomBytes } from 'node:crypto';

/** Nomba orderReference max is 50 chars. */
export function buildMonnifyWalletTopupOrderRef(tenantId: string): string {
  return `wm_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function isMonnifyWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wm_${tenantKey}_`);
}

/** Recover tenant UUID from `wm_{uuidNoHyphens}_…` when webhook meta is missing. */
export function parseTenantIdFromMonnifyWalletTopupOrderRef(orderReference: string): string | null {
  const match = /^wm_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildNombaWalletTopupOrderRef(tenantId: string): string {
  return `wt_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function buildNoahWalletTopupOrderRef(tenantId: string): string {
  return `nw_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function isNoahWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`nw_${tenantKey}_`);
}

export function isNombaWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wt_${tenantKey}_`);
}

export function buildBachsWalletTopupOrderRef(tenantId: string): string {
  return `wb_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function buildFincraWalletTopupOrderRef(tenantId: string): string {
  return `wf_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function isBachsWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wb_${tenantKey}_`);
}

export function isFincraWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wf_${tenantKey}_`);
}

/** Recover tenant UUID from `wf_{uuidNoHyphens}_…` when webhook meta is missing. */
export function parseTenantIdFromFincraWalletTopupOrderRef(orderReference: string): string | null {
  const match = /^wf_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Infer checkout rail from our order-reference prefix (wm_/wt_/nw_/wb_/wf_). */
export function resolveWalletTopupProviderFromOrderRef(
  orderReference: string,
  tenantId: string,
): 'monnify' | 'nomba' | 'noah' | 'bachs' | 'fincra' | null {
  if (isMonnifyWalletTopupOrderRef(orderReference, tenantId)) return 'monnify';
  if (isNombaWalletTopupOrderRef(orderReference, tenantId)) return 'nomba';
  if (isNoahWalletTopupOrderRef(orderReference, tenantId)) return 'noah';
  if (isBachsWalletTopupOrderRef(orderReference, tenantId)) return 'bachs';
  if (isFincraWalletTopupOrderRef(orderReference, tenantId)) return 'fincra';
  return null;
}
