import {
  buildNoahWalletTopupOrderRef,
  buildNombaWalletTopupOrderRef,
  isNoahWalletTopupOrderRef,
} from './wallet-order-ref.util';

describe('wallet-order-ref.util', () => {
  const tenantId = '4986dd87-d1ea-4c33-adee-c2b0148b368f';

  it('builds wallet top-up checkout refs within Nomba 50-char limit', () => {
    const ref = buildNombaWalletTopupOrderRef(tenantId);
    expect(ref).toMatch(/^wt_4986dd87d1ea4c33adeec2b0148b368f_/);
    expect(ref.length).toBeLessThanOrEqual(50);
  });

  it('builds Noah wallet top-up refs', () => {
    const ref = buildNoahWalletTopupOrderRef(tenantId);
    expect(ref).toMatch(/^nw_4986dd87d1ea4c33adeec2b0148b368f_/);
    expect(isNoahWalletTopupOrderRef(ref, tenantId)).toBe(true);
  });
});
