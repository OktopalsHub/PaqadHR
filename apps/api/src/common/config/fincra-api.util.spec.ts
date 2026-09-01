import {
  isFincraPayoutNotFound,
  resolveFincraFiatPaymentScheme,
  resolveFincraPaymentScheme,
} from './fincra-api.util';

describe('fincra-api.util', () => {
  describe('isFincraPayoutNotFound', () => {
    it('detects HTTP 404 and explicit RESOURCE_NOT_FOUND client responses', () => {
      expect(isFincraPayoutNotFound(404, {})).toBe(true);
      expect(isFincraPayoutNotFound(400, { code: 'RESOURCE_NOT_FOUND' })).toBe(true);
      expect(isFincraPayoutNotFound(400, { message: 'RESOURCE_NOT_FOUND' })).toBe(true);
    });

    it('does not treat ambiguous client or server errors as not found', () => {
      expect(isFincraPayoutNotFound(400, { message: 'Payout not found' })).toBe(false);
      expect(isFincraPayoutNotFound(400, { message: 'gateway: PAYOUT NOT FOUND in cache' })).toBe(
        false,
      );
      expect(isFincraPayoutNotFound(503, { message: 'upstream unavailable' })).toBe(false);
      expect(isFincraPayoutNotFound(503, { message: 'RESOURCE_NOT_FOUND' })).toBe(false);
      expect(isFincraPayoutNotFound(503, { code: 'RESOURCE_NOT_FOUND' })).toBe(false);
    });
  });

  describe('resolveFincraFiatPaymentScheme', () => {
    it('maps GBP to fps', () => {
      expect(resolveFincraFiatPaymentScheme('GBP', 'GB')).toBe('fps');
    });

    it('maps EUR to sepa', () => {
      expect(resolveFincraFiatPaymentScheme('EUR', 'DE')).toBe('sepa');
    });

    it('maps US USD to ach and non-US USD to swift', () => {
      expect(resolveFincraFiatPaymentScheme('USD', 'US')).toBe('ach');
      expect(resolveFincraFiatPaymentScheme('USD', 'NG')).toBe('swift');
    });
  });

  describe('resolveFincraPaymentScheme', () => {
    it('maps USDT network to trc20 scheme', () => {
      expect(resolveFincraPaymentScheme('USDT', 'TRC20')).toBe('usdt_trc20');
    });
  });
});
