import { randomBytes } from 'node:crypto';

export function buildNombaAccountRef(tenantId: string): string {
  // Nomba rejects references longer than 50 characters. "rewards_wallet_" (15)
  // plus a 36-char UUID is 51, so drop the UUID hyphens (→ 47) while keeping the
  // ref deterministic per tenant.
  return `rewards_wallet_${tenantId.replace(/-/g, '')}`;
}

export function buildNombaWalletTopupOrderRef(tenantId: string): string {
  return `wt_${tenantId.replace(/-/g, '')}_${Date.now().toString(36)}${randomBytes(2).toString('hex').slice(0, 3)}`;
}

export function buildVirtualAccountName(tenantName?: string): string {
  const base = (tenantName || 'Paqad Rewards Wallet').replace(/[^\w\s-]/g, '').trim();
  const name = base.length >= 8 ? base : `Paqad ${base}`.trim();
  if (name.length >= 8) {
    return name.slice(0, 64);
  }
  return 'Paqad Rewards Wallet'.slice(0, 64);
}
