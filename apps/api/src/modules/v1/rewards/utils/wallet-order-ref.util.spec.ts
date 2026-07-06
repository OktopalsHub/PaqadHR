import { buildNombaWalletTopupOrderRef } from './wallet-order-ref.util';

describe('wallet-order-ref.util', () => {
  it('builds wallet top-up checkout refs within Nomba 50-char limit', () => {
    const tenantId = '4986dd87-d1ea-4c33-adee-c2b0148b368f';
    const ref = buildNombaWalletTopupOrderRef(tenantId);
    expect(ref).toMatch(/^wt_4986dd87d1ea4c33adeec2b0148b368f_/);
    expect(ref.length).toBeLessThanOrEqual(50);
  });
});
