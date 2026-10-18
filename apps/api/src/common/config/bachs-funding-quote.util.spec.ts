import {
  applyPayrollFee,
  pickBachsFundingCurrency,
  quoteSourceAmountForDestination,
  resolveBachsQuoteDestinationCurrency,
  sourceAmountForBachsFundingItem,
  sumBachsFundingSourceAmount,
} from './bachs-funding-quote.util';
import { mapBachsCryptoDestinationCurrency } from './bachs-payout.util';

describe('bachs-funding-quote.util', () => {
  describe('pickBachsFundingCurrency', () => {
    it('picks USD when any item is not NGN', () => {
      expect(
        pickBachsFundingCurrency([{ paymentCurrency: 'NGN' }, { paymentCurrency: 'GBP' }]),
      ).toBe('USD');
    });

    it('picks NGN for all-NGN runs', () => {
      expect(pickBachsFundingCurrency([{ paymentCurrency: 'NGN' }])).toBe('NGN');
    });

    it('forces USD when payout source currency is USD', () => {
      expect(pickBachsFundingCurrency([{ paymentCurrency: 'NGN' }], 'USD')).toBe('USD');
    });
  });

  describe('resolveBachsQuoteDestinationCurrency', () => {
    it('maps USDT networks', () => {
      expect(resolveBachsQuoteDestinationCurrency('USDT', 'TRC20')).toBe('USDT_TRC20');
      expect(resolveBachsQuoteDestinationCurrency('USDT', 'BEP20')).toBe('USDT_BEP20');
    });

    it('maps USDC networks', () => {
      expect(resolveBachsQuoteDestinationCurrency('USDC', 'Base')).toBe('USDC_BASE');
    });

    it('refuses to default a missing or unsupported USDT network to TRC20', () => {
      // The provider throws for these, so quoting them would size a checkout for a rail
      // that can never pay out.
      expect(resolveBachsQuoteDestinationCurrency('USDT', null)).toBeNull();
      expect(resolveBachsQuoteDestinationCurrency('USDT', undefined)).toBeNull();
      expect(resolveBachsQuoteDestinationCurrency('USDT', 'Polygon')).toBeNull();
    });

    it('never swaps USDT for USDC on Base', () => {
      expect(resolveBachsQuoteDestinationCurrency('USDT', 'Base')).toBeNull();
    });
  });

  describe('funding and payout agree on the destination', () => {
    // The funding value sizes the checkout the tenant pays; the payout value decides where
    // the money lands. If they disagree, either we charge for a rail that cannot pay out or
    // we pay on a rail the tenant was not quoted for.
    const cases: Array<[string, string | null | undefined]> = [
      ['USDT', 'TRC20'],
      ['USDT', 'BEP20'],
      ['USDT', 'ERC20'],
      ['USDT', 'SOL'],
      ['USDT', 'Base'],
      ['USDT', 'Polygon'],
      ['USDT', null],
      ['USDC', 'Base'],
      ['USDC', 'BEP20'],
      ['USDC', 'TRC20'],
    ];

    it.each(cases)('%s on %s resolves identically in both layers', (currency, network) => {
      expect(resolveBachsQuoteDestinationCurrency(currency, network)).toBe(
        mapBachsCryptoDestinationCurrency(network, currency),
      );
    });
  });

  describe('quoteSourceAmountForDestination', () => {
    it('probes then quotes the implied source amount', async () => {
      const createQuote = jest
        .fn()
        .mockResolvedValueOnce({
          quote_id: 'pqt_probe',
          from_amount: '100.00',
          to_amount: '74.30',
        })
        .mockResolvedValueOnce({
          quote_id: 'pqt_final',
          from_amount: '500.00',
          to_amount: '371.50',
        });

      const result = await quoteSourceAmountForDestination({
        createQuote,
        fromCurrency: 'USD',
        toCurrency: 'GBP',
        targetToAmount: 371.5,
        payoutMethod: 'BANK_TRANSFER',
      });

      expect(result.quoteId).toBe('pqt_final');
      expect(result.sourceAmount).toBe(500);
      expect(createQuote).toHaveBeenCalledTimes(2);
    });

    it('does not send amount NaN when a refinement quote lacks from_amount', async () => {
      const createQuote = jest
        .fn()
        .mockResolvedValueOnce({
          quote_id: 'pqt_probe',
          from_amount: '100.00',
          to_amount: '50.00',
        })
        .mockResolvedValueOnce({
          quote_id: 'pqt_second',
          // Missing from_amount — must not produce a third call with amount: "NaN".
          to_amount: '80.00',
        });

      await expect(
        quoteSourceAmountForDestination({
          createQuote,
          fromCurrency: 'USD',
          toCurrency: 'GBP',
          targetToAmount: 100,
          payoutMethod: 'BANK_TRANSFER',
        }),
      ).rejects.toThrow(/missing source amount/i);

      expect(createQuote).toHaveBeenCalledTimes(2);
      for (const [input] of createQuote.mock.calls) {
        expect(String((input as { amount: string }).amount)).not.toBe('NaN');
      }
    });
  });

  describe('sourceAmountForBachsFundingItem', () => {
    it('uses destination-fixed quotes for GBP salaries funded in USD', async () => {
      const createQuote = jest
        .fn()
        .mockResolvedValueOnce({
          quote_id: 'pqt_probe',
          from_amount: '100.00',
          to_amount: '80.00',
        })
        .mockResolvedValueOnce({
          quote_id: 'pqt_final',
          from_amount: '125.00',
          to_amount: '100.00',
        });

      const source = await sourceAmountForBachsFundingItem({
        fundingCurrency: 'USD',
        createQuote,
        item: {
          amount: 100,
          amountCurrency: 'GBP',
          paymentCurrency: 'GBP',
        },
      });

      expect(source).toBe(125);
    });

    it('grosses up USD-denominated salaries paid in USDT using a live quote', async () => {
      const createQuote = jest
        .fn()
        .mockResolvedValueOnce({
          quote_id: 'pqt_probe',
          from_amount: '100.00',
          to_amount: '98.00',
        })
        .mockResolvedValueOnce({
          quote_id: 'pqt_final',
          from_amount: '255.11',
          to_amount: '250.00',
        });

      const source = await sourceAmountForBachsFundingItem({
        fundingCurrency: 'USD',
        createQuote,
        item: {
          amount: 250,
          amountCurrency: 'USD',
          paymentCurrency: 'USDT',
          cryptoNetwork: 'TRC20',
          fxAtPayout: true,
        },
      });

      expect(source).toBe(255.11);
      expect(createQuote).toHaveBeenCalledTimes(2);
      expect(createQuote).toHaveBeenCalledWith(
        expect.objectContaining({ fromCurrency: 'USD', toCurrency: 'USDT_TRC20' }),
      );
    });

    it('quotes USDT payouts from USD so current provider costs are included', async () => {
      const createQuote = jest
        .fn()
        .mockResolvedValueOnce({
          quote_id: 'pqt_probe',
          from_amount: '100.00',
          to_amount: '98.00',
        })
        .mockResolvedValueOnce({
          quote_id: 'pqt_final',
          from_amount: '255.11',
          to_amount: '250.00',
        });

      const source = await sourceAmountForBachsFundingItem({
        fundingCurrency: 'USD',
        createQuote,
        item: {
          amount: 250,
          amountCurrency: 'USDT',
          paymentCurrency: 'USDT',
          cryptoNetwork: 'TRC20',
        },
      });

      expect(source).toBe(255.11);
      expect(createQuote).toHaveBeenCalledTimes(2);
      expect(createQuote).toHaveBeenCalledWith(
        expect.objectContaining({ fromCurrency: 'USD', toCurrency: 'USDT_TRC20' }),
      );
    });
  });

  describe('sumBachsFundingSourceAmount + fee', () => {
    it('sums mixed items and applies fee', async () => {
      const createQuote = jest.fn().mockImplementation(async (input) => {
        if (input.amount === '100.00') {
          return { quote_id: 'probe', from_amount: '100.00', to_amount: '100.00' };
        }
        return {
          quote_id: 'q',
          from_amount: input.amount,
          to_amount: input.amount,
        };
      });

      const employeeTotal = await sumBachsFundingSourceAmount({
        fundingCurrency: 'USD',
        createQuote,
        items: [
          { amount: 500, amountCurrency: 'USD', paymentCurrency: 'USD' },
          {
            amount: 100,
            amountCurrency: 'GBP',
            paymentCurrency: 'GBP',
          },
        ],
      });

      // USD 500 + GBP 100 quoted 1:1 from the mock → 600
      expect(employeeTotal).toBe(600);
      const fee = applyPayrollFee(employeeTotal, 3);
      expect(fee.platformFee).toBe(18);
      expect(fee.checkoutTotal).toBe(618);
    });
  });
});
