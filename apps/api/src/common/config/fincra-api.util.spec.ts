import {
  resolveFincraFiatPaymentScheme,
  resolveFincraPaymentScheme,
} from './fincra-api.util';

describe('fincra-api.util', () => {
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
