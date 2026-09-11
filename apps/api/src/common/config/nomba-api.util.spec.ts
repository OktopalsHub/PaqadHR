import {
  isNombaAcceptedCode,
  isNombaCheckoutPaymentSuccessful,
  isNombaOperationSuccessful,
  nombaCheckoutOrderPath,
  parseNombaAmount,
  resolveNombaTokenExpiresAtMs,
  resolveNombaVerifiedCheckoutAmount,
} from './nomba-api.util';

describe('nomba-api.util', () => {
  it('accepts Nomba success and processing codes', () => {
    expect(isNombaAcceptedCode('00')).toBe(true);
    expect(isNombaAcceptedCode('200')).toBe(true);
    expect(isNombaAcceptedCode('202')).toBe(true);
    expect(isNombaAcceptedCode(202)).toBe(true);
    expect(isNombaAcceptedCode('02')).toBe(false);
    expect(isNombaAcceptedCode(undefined)).toBe(false);
  });

  it('treats processing status as successful acceptance', () => {
    expect(isNombaOperationSuccessful({ code: '202', status: 'Processing...' })).toBe(true);
    expect(isNombaOperationSuccessful({ code: '00' })).toBe(true);
    expect(isNombaOperationSuccessful({ status: 'PENDING_BILLING' })).toBe(true);
    expect(isNombaOperationSuccessful({ code: '02', status: 'FAILED' })).toBe(false);
  });

  it('prefers expiresAt over expires_in', () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const resolved = resolveNombaTokenExpiresAtMs({ expiresAt, expires_in: 3600 });
    expect(resolved).toBeLessThan(Date.now() + 30 * 60 * 1000);
    expect(resolved).toBeGreaterThan(Date.now() + 20 * 60 * 1000);
  });

  it('defaults to ~25 minutes when expiry fields are missing', () => {
    const resolved = resolveNombaTokenExpiresAtMs({});
    expect(resolved).toBeGreaterThan(Date.now() + 20 * 60 * 1000);
    expect(resolved).toBeLessThanOrEqual(Date.now() + 25 * 60 * 1000);
  });

  it('parses Nomba checkout amounts and prefers order amount', () => {
    expect(parseNombaAmount('5000.00')).toBe(5000);
    expect(parseNombaAmount(100)).toBe(100);
    expect(
      resolveNombaVerifiedCheckoutAmount({
        amount: 100,
        onlineCheckoutAmount: '5000.00',
        order: { amount: '5000.00' },
      }),
    ).toBe(5000);
  });

  it('detects checkout success without matching unsuccessful', () => {
    expect(isNombaCheckoutPaymentSuccessful({ status: 'SUCCESS' })).toBe(true);
    expect(isNombaCheckoutPaymentSuccessful({ status: 'PAYMENT_SUCCESSFUL' })).toBe(true);
    expect(isNombaCheckoutPaymentSuccessful({ successFlag: true })).toBe(true);
    expect(isNombaCheckoutPaymentSuccessful({ status: 'unsuccessful' })).toBe(false);
    expect(nombaCheckoutOrderPath(false)).toBe('/sandbox/checkout/order');
    expect(nombaCheckoutOrderPath(true)).toBe('/v1/checkout/order');
  });
});
