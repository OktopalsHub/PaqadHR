import {
  isBachsIntlBankCurrency,
  mapBachsCryptoDestinationCurrency,
  normalizeBachsUsdtNetwork,
  parseBachsPayoutWebhook,
  parseBachsUkIban,
} from './bachs-payout.util';

describe('isBachsIntlBankCurrency', () => {
  it('accepts USD EUR GBP only', () => {
    expect(isBachsIntlBankCurrency('USD')).toBe(true);
    expect(isBachsIntlBankCurrency('eur')).toBe(true);
    expect(isBachsIntlBankCurrency('GBP')).toBe(true);
    expect(isBachsIntlBankCurrency('NGN')).toBe(false);
    expect(isBachsIntlBankCurrency('CAD')).toBe(false);
  });
});

describe('parseBachsUkIban', () => {
  it('extracts sort code and account number', () => {
    expect(parseBachsUkIban('GB29 NWBK 601613 31926819')).toEqual({
      iban: 'GB29NWBK60161331926819',
      sortCode: '601613',
      accountNumber: '31926819',
    });
  });
});

describe('mapBachsCryptoDestinationCurrency', () => {
  it('maps TRC20 aliases to USDT_TRC20', () => {
    expect(mapBachsCryptoDestinationCurrency('TRC20')).toBe('USDT_TRC20');
    expect(mapBachsCryptoDestinationCurrency('Tron')).toBe('USDT_TRC20');
  });

  it('maps BEP20 aliases to USDT_BEP20', () => {
    expect(mapBachsCryptoDestinationCurrency('BEP20')).toBe('USDT_BEP20');
    expect(mapBachsCryptoDestinationCurrency('BSC')).toBe('USDT_BEP20');
  });

  it('maps ERC20 aliases to USDT_ERC20', () => {
    expect(mapBachsCryptoDestinationCurrency('Ethereum')).toBe('USDT_ERC20');
    expect(mapBachsCryptoDestinationCurrency('eth')).toBe('USDT_ERC20');
  });

  it('maps SOL aliases to USDT_SOL', () => {
    expect(mapBachsCryptoDestinationCurrency('Solana')).toBe('USDT_SOL');
    expect(mapBachsCryptoDestinationCurrency('SOL')).toBe('USDT_SOL');
    expect(mapBachsCryptoDestinationCurrency('sol')).toBe('USDT_SOL');
  });

  it('returns null for networks Bachs does not deliver', () => {
    expect(mapBachsCryptoDestinationCurrency('Bitcoin')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency('')).toBeNull();
    expect(mapBachsCryptoDestinationCurrency(null)).toBeNull();
    expect(mapBachsCryptoDestinationCurrency(undefined)).toBeNull();
  });

  describe('with an explicit asset', () => {
    it('keeps a valid asset/network pair', () => {
      expect(mapBachsCryptoDestinationCurrency('TRC20', 'USDT')).toBe('USDT_TRC20');
      expect(mapBachsCryptoDestinationCurrency('BEP20', 'USDT')).toBe('USDT_BEP20');
      expect(mapBachsCryptoDestinationCurrency('Base', 'USDC')).toBe('USDC_BASE');
      expect(mapBachsCryptoDestinationCurrency('BEP20', 'USDC')).toBe('USDC_BEP20');
    });

    it('refuses to swap USDT for USDC on Base', () => {
      // Without the asset, a bare "Base" resolves to USDC_BASE — paying a USDT salary in USDC
      // to a chain the employee never picked. Refuse instead of silently substituting.
      expect(mapBachsCryptoDestinationCurrency('Base')).toBe('USDC_BASE');
      expect(mapBachsCryptoDestinationCurrency('Base', 'USDT')).toBeNull();
    });

    it('refuses networks Bachs cannot deliver for that asset', () => {
      expect(mapBachsCryptoDestinationCurrency('TRC20', 'USDC')).toBeNull();
      expect(mapBachsCryptoDestinationCurrency('Base', 'USDT')).toBeNull();
      expect(mapBachsCryptoDestinationCurrency('USDT_Base', 'USDT')).toBeNull();
    });

    it('ignores the asset prefix in a fully-qualified code', () => {
      expect(mapBachsCryptoDestinationCurrency('USDT_TRC20', 'USDT')).toBe('USDT_TRC20');
      expect(mapBachsCryptoDestinationCurrency('USDC_BASE', 'USDC')).toBe('USDC_BASE');
      expect(mapBachsCryptoDestinationCurrency('USDC_BASE', 'USDT')).toBeNull();
    });
  });
});

describe('normalizeBachsUsdtNetwork', () => {
  it('canonicalizes Bachs USDT networks', () => {
    expect(normalizeBachsUsdtNetwork('trc20')).toBe('TRC20');
    expect(normalizeBachsUsdtNetwork('Tron')).toBe('TRC20');
    expect(normalizeBachsUsdtNetwork('BEP20')).toBe('BEP20');
    expect(normalizeBachsUsdtNetwork('Ethereum')).toBe('ERC20');
    expect(normalizeBachsUsdtNetwork('Solana')).toBe('SOL');
  });

  it('returns null for networks Bachs cannot deliver', () => {
    expect(normalizeBachsUsdtNetwork('Bitcoin')).toBeNull();
    expect(normalizeBachsUsdtNetwork('Polygon')).toBeNull();
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
