import { randomBytes } from 'node:crypto';

/** Nomba orderReference max is 50 chars. */
export function buildMonnifyWalletTopupOrderRef(tenantId: string): string {
  return `wm_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function isMonnifyWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wm_${tenantKey}_`);
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

export function isBachsWalletTopupOrderRef(orderReference: string, tenantId: string): boolean {
  const tenantKey = tenantId.replace(/-/g, '');
  return orderReference.startsWith(`wb_${tenantKey}_`);
}
