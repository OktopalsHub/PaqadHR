import { resolvePayrollPayoutConversion } from './payroll-payout-conversion.util';

type FiatExchangeConvert = {
  convert: (amount: number, from: string, to: string) => Promise<number>;
};

describe('resolvePayrollPayoutConversion', () => {
  it('returns 1:1 when salary and payout currencies match', async () => {
    const fiatExchange: FiatExchangeConvert = { convert: async () => 0 };
    const result = await resolvePayrollPayoutConversion(150_000, 'NGN', 'NGN', fiatExchange);
    expect(result).toEqual({ paymentAmount: 150_000, exchangeRate: 1, fxAtPayout: false });
  });

  it('defers amount to payout when salary is fiat and payout is crypto', async () => {
    const fiatExchange: FiatExchangeConvert = { convert: async () => 0 };
    const result = await resolvePayrollPayoutConversion(150_000, 'NGN', 'SOL', fiatExchange);
    expect(result.fxAtPayout).toBe(true);
    expect(result.paymentAmount).toBe(0);
  });

  it('converts fiat salary to fiat payout', async () => {
    const fiatExchange: FiatExchangeConvert = {
      convert: async (amount: number) => amount * 0.00065,
    };
    const result = await resolvePayrollPayoutConversion(100_000, 'NGN', 'USD', fiatExchange);
    expect(result.fxAtPayout).toBe(false);
    expect(result.paymentAmount).toBe(65);
    expect(result.exchangeRate).toBeCloseTo(0.00065);
  });
});
