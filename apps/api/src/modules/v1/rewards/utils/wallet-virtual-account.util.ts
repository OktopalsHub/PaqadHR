export function buildNombaAccountRef(tenantId: string): string {
  return `rewards_wallet_${tenantId}`;
}

export function buildVirtualAccountName(tenantName?: string): string {
  const base = (tenantName || 'Paqad Rewards Wallet').replace(/[^\w\s-]/g, '').trim();
  const name = base.length >= 8 ? base : `Paqad ${base}`.trim();
  if (name.length >= 8) {
    return name.slice(0, 64);
  }
  return 'Paqad Rewards Wallet'.slice(0, 64);
}
