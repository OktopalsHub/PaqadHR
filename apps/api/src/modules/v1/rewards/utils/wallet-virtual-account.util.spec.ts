import {
  buildNombaAccountRef,
  buildNombaWalletTopupOrderRef,
  buildVirtualAccountName,
} from './wallet-virtual-account.util';

describe('wallet-virtual-account.util', () => {
  it('builds stable account ref from tenant id within Nomba 50-char limit', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    expect(buildNombaAccountRef(tenantId)).toBe('rewards_wallet_11111111111141118111111111111111');
    // Deterministic per tenant, and must not exceed Nomba's 50-char reference limit.
    expect(buildNombaAccountRef(tenantId)).toBe(buildNombaAccountRef(tenantId));
    expect(buildNombaAccountRef(tenantId).length).toBeGreaterThanOrEqual(16);
    expect(buildNombaAccountRef(tenantId).length).toBeLessThanOrEqual(50);
  });

  it('builds wallet top-up checkout refs within Nomba 50-char limit', () => {
    const tenantId = '4986dd87-d1ea-4c33-adee-c2b0148b368f';
    const ref = buildNombaWalletTopupOrderRef(tenantId);
    expect(ref).toMatch(/^wt_4986dd87d1ea4c33adeec2b0148b368f_[a-z0-9]+$/);
    expect(ref.length).toBeLessThanOrEqual(50);
    expect(buildNombaWalletTopupOrderRef(tenantId)).not.toBe(ref);
  });

  it('pads short tenant names to meet Nomba minimum', () => {
    expect(buildVirtualAccountName('Acme').length).toBeGreaterThanOrEqual(8);
  });

  it('truncates long tenant names', () => {
    const long = 'A'.repeat(100);
    expect(buildVirtualAccountName(long).length).toBeLessThanOrEqual(64);
  });
});
