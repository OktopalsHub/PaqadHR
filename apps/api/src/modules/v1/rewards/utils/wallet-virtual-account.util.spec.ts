import { buildNombaAccountRef, buildVirtualAccountName } from './wallet-virtual-account.util';

describe('wallet-virtual-account.util', () => {
  it('builds stable account ref from tenant id', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    expect(buildNombaAccountRef(tenantId)).toBe(`rewards_wallet_${tenantId}`);
    expect(buildNombaAccountRef(tenantId).length).toBeGreaterThanOrEqual(16);
  });

  it('pads short tenant names to meet Nomba minimum', () => {
    expect(buildVirtualAccountName('Acme').length).toBeGreaterThanOrEqual(8);
  });

  it('truncates long tenant names', () => {
    const long = 'A'.repeat(100);
    expect(buildVirtualAccountName(long).length).toBeLessThanOrEqual(64);
  });
});
