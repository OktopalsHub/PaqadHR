import {
  isFincraPayoutNotFound,
  resolveFincraFiatPaymentScheme,
  resolveFincraPaymentScheme,
} from './fincra-api.util';

describe('fincra-api.util', () => {
  describe('isFincraPayoutNotFound', () => {
    it('detects HTTP 404 and RESOURCE_NOT_FOUND messages', () => {
      expect(isFincraPayoutNotFound(404, {})).toBe(true);
      expect(isFincraPayoutNotFound(400, { message: 'RESOURCE_NOT_FOUND' })).toBe(true);
      expect(isFincraPayoutNotFound(400, { message: 'Payout not found' })).toBe(true);
      expect(isFincraPayoutNotFound(503, { message: 'upstream unavailable' })).toBe(false);
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
