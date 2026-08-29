import { parseTenantIdFromFincraWalletTopupOrderRef } from './wallet-order-ref.util';

describe('wallet-order-ref.util (Fincra)', () => {
  it('parses tenant id from wf_ order reference', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const ref = `wf_${tenantId.replace(/-/g, '')}_abc123`;
    expect(parseTenantIdFromFincraWalletTopupOrderRef(ref)).toBe(tenantId);
  });

  it('returns null for non-Fincra refs', () => {
    expect(parseTenantIdFromFincraWalletTopupOrderRef('wm_abc')).toBeNull();
  });
});
