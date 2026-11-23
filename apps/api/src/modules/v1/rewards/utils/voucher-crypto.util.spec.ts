import { openVoucher, sealVoucher, voucherTransformer } from './voucher-crypto.util';

describe('voucher encryption', () => {
  const voucher = {
    code: 'https://rewards.example.com:8443/redeem/abc?x=1:2',
    pin: '4821',
    instructions: 'Open this link to redeem.',
  };

  it('encrypts the code and pin but leaves instructions readable', () => {
    const sealed = sealVoucher(voucher);
    expect(sealed.code).not.toContain('rewards.example.com');
    expect(sealed.pin).not.toBe('4821');
    expect(sealed.code?.startsWith('enc1.')).toBe(true);
    expect(sealed.instructions).toBe(voucher.instructions);
  });

  it('round-trips, including links that contain colons', () => {
    expect(openVoucher(sealVoucher(voucher))).toEqual(voucher);
  });

  it('does not encrypt twice, and gives each encryption a fresh nonce', () => {
    const once = sealVoucher(voucher);
    expect(sealVoucher(once)).toEqual(once);
    expect(sealVoucher(voucher).code).not.toBe(once.code);
  });

  it('returns rows written before encryption existed unchanged', () => {
    expect(openVoucher({ code: 'LEGACY-123', instructions: 'x' })).toEqual({
      code: 'LEGACY-123',
      instructions: 'x',
    });
  });

  it('passes null and instruction-only vouchers through the column transformer', () => {
    expect(voucherTransformer.to(null)).toBeNull();
    expect(voucherTransformer.from(null)).toBeNull();
    expect(voucherTransformer.to({ instructions: 'soon' })).toEqual({ instructions: 'soon' });
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const sealed = sealVoucher({ code: 'SECRET' });
    const tampered = { ...sealed, code: `${sealed.code?.slice(0, -2)}AA` };
    expect(() => openVoucher(tampered)).toThrow();
  });
});
