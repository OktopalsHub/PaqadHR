import {
  mapBachsCryptoDestinationCurrency,
  normalizeBachsUsdtNetwork,
  parseBachsPayoutWebhook,
} from './bachs-payout.util';

describe('mapBachsCryptoDestinationCurrency', () => {
  it('maps TRC20 aliases to USDT_TRC20', () => {
    expect(mapBachsCryptoDestinationCurrency('TRC20')).toBe('USDT_TRC20');
    expect(mapBachsCryptoDestinationCurrency('trc-20')).toBe('USDT_TRC20');
    expect(mapBachsCryptoDestinationCurrency('Tron')).toBe('USDT_TRC20');
  });

  it('maps BEP20 aliases to USDT_BEP20', () => {
    expect(mapBachsCryptoDestinationCurrency('BEP20')).toBe('USDT_BEP20');
    expect(mapBachsCryptoDestinationCurrency('bep_20')).toBe('USDT_BEP20');
    expect(mapBachsCryptoDestinationCurrency('BSC')).toBe('USDT_BEP20');
  });

  it('returns null for networks Bachs does not deliver', () => {
    expect(mapBachsCryptoDestinationCurrency('Ethereum')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency('ERC20')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency('Bitcoin')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency('')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency(null)).toBeNull();
    expect(mapBachsCryptoDestinationCurrency(undefined)).toBeNull();
  });
});

describe('normalizeBachsUsdtNetwork', () => {
  it('canonicalizes Bachs USDT networks', () => {
    expect(normalizeBachsUsdtNetwork('trc20')).toBe('TRC20');
    expect(normalizeBachsUsdtNetwork('Tron')).toBe('TRC20');
    expect(normalizeBachsUsdtNetwork('BEP20')).toBe('BEP20');
    expect(normalizeBachsUsdtNetwork('USDT_BEP20')).toBe('BEP20');
  });

  it('returns null for networks Bachs cannot deliver', () => {
    expect(normalizeBachsUsdtNetwork('Ethereum')).toBeNull();
    expect(normalizeBachsUsdtNetwork('Solana')).toBeNull();
    expect(normalizeBachsUsdtNetwork(undefined)).toBeNull();
    expect(normalizeBachsUsdtNetwork('')).toBeNull();
  });
});

describe('parseBachsPayoutWebhook', () => {
  it('parses payout.paid with delivered amount', () => {
    const event = parseBachsPayoutWebhook({
      id: 'evt_1',
      type: 'payout.paid',
      data: {
        withdrawal_id: 'pay_4Xr9dLc0mNv7Kq2B',
        reference: 'pi_abc',
        status: 'completed',
        amount: '500.00',
        currency: 'USD',
        from_currency: 'USD',
        to_currency: 'NGN',
        exchange_rate: '1650.00',
        to_amount: '825000.00',
      },
    });
    expect(event).toEqual({
      eventType: 'payout.paid',
      withdrawalId: 'pay_4Xr9dLc0mNv7Kq2B',
      reference: 'pi_abc',
      status: 'completed',
      amount: 500,
      toAmount: 825000,
      fromCurrency: 'USD',
      toCurrency: 'NGN',
    });
  });

  it('parses payout.failed and defaults status from the event type', () => {
    const event = parseBachsPayoutWebhook({
      type: 'payout.failed',
      data: { withdrawal_id: 'pay_x', reference: null },
    });
    expect(event?.eventType).toBe('payout.failed');
    expect(event?.status).toBe('failed');
    expect(event?.reference).toBeNull();
    expect(event?.toAmount).toBeUndefined();
  });

  it('returns null for non-payout events', () => {
    expect(parseBachsPayoutWebhook({ type: 'collection.succeeded', data: {} })).toBeNull();
    expect(parseBachsPayoutWebhook({ type: 'invoice.paid' })).toBeNull();
  });

  it('returns null when the withdrawal id is missing', () => {
    expect(
      parseBachsPayoutWebhook({ type: 'payout.paid', data: { reference: 'pi_abc' } }),
    ).toBeNull();
  });

  it('returns null for malformed payloads', () => {
    expect(parseBachsPayoutWebhook(null)).toBeNull();
    expect(parseBachsPayoutWebhook('nope')).toBeNull();
    expect(parseBachsPayoutWebhook(undefined)).toBeNull();
  });
});
