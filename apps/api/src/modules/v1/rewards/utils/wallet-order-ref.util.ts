import { randomBytes } from 'node:crypto';

/** Nomba orderReference max is 50 chars. */
export function buildNombaWalletTopupOrderRef(tenantId: string): string {
  return `wt_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}
