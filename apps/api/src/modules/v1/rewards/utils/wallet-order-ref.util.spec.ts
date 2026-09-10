import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';
import {
  buildWalletTopupOrderRef,
  isFincraWalletTopupOrderRef,
  isNombaWalletTopupOrderRef,
  parseTenantIdFromFincraWalletTopupOrderRef,
  parseTenantIdFromWalletTopupOrderRef,
} from './wallet-order-ref.util';

describe('wallet-order-ref.util', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('parses tenant id from wf_ order reference', () => {
    const ref = `wf_${tenantId.replace(/-/g, '')}_abc123`;
    expect(parseTenantIdFromFincraWalletTopupOrderRef(ref)).toBe(tenantId);
    expect(parseTenantIdFromWalletTopupOrderRef(ref)).toBe(tenantId);
  });

  it('returns null for non-wallet-topup refs', () => {
    expect(parseTenantIdFromFincraWalletTopupOrderRef('wm_abc')).toBeNull();
    expect(parseTenantIdFromWalletTopupOrderRef('manual-topup-abc')).toBeNull();
  });

  it('builds unique Fincra refs with 64 bits of entropy within the 80-char DTO limit', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const refs = Array.from({ length: 64 }, () =>
        buildWalletTopupOrderRef(PaymentProvider.FINCRA, tenantId),
      );
      expect(new Set(refs).size).toBe(refs.length);
      for (const ref of refs) {
        expect(ref.length).toBeLessThanOrEqual(80);
        expect(ref.slice(-16)).toMatch(/^[0-9a-f]{16}$/);
        expect(isFincraWalletTopupOrderRef(ref, tenantId)).toBe(true);
        expect(parseTenantIdFromFincraWalletTopupOrderRef(ref)).toBe(tenantId);
      }
    } finally {
      now.mockRestore();
    }
  });

  it('builds Nomba refs within the 50-char gateway limit', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const ref = buildWalletTopupOrderRef(PaymentProvider.NOMBA, tenantId);
      expect(ref.length).toBeLessThanOrEqual(50);
      expect(isNombaWalletTopupOrderRef(ref, tenantId)).toBe(true);
      expect(ref.slice(-6)).toMatch(/^[0-9a-f]{6}$/);
    } finally {
      now.mockRestore();
    }
  });
});
