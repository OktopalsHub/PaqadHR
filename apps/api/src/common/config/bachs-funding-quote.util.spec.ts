import {
  applyPayrollFee,
  pickBachsFundingCurrency,
  quoteSourceAmountForDestination,
  resolveBachsQuoteDestinationCurrency,
  sourceAmountForBachsFundingItem,
  sumBachsFundingSourceAmount,
} from './bachs-funding-quote.util';

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
      expect(resolveBachsQuoteDestinationCurrency('USDT', null)).toBe('USDT_TRC20');
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

    it('treats USDT as 1:1 with USD for funding', async () => {
      const createQuote = jest.fn();
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
      expect(source).toBe(250);
      expect(createQuote).not.toHaveBeenCalled();
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
