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

  it('defers amount to payout when salary is fiat and payout is a stablecoin', async () => {
    // fxAtPayout carries no amount: the provider quotes it. There is no NGN→USDT rate in
    // fiatExchange, so the amount must stay 0 and be resolved by the provider at payout time.
    const fiatExchange: FiatExchangeConvert = { convert: async () => 0 };
    const result = await resolvePayrollPayoutConversion(150_000, 'NGN', 'USDT', fiatExchange);
    expect(result.fxAtPayout).toBe(true);
    expect(result.paymentAmount).toBe(0);
  });

  it('rejects an unsupported native-asset payout instead of quoting a rate that cannot exist', async () => {
    // There is no NGN→SOL rate. Falling through to the fiat converter would silently
    // produce a bogus amount that then gets paid out.
    const convert = jest.fn().mockResolvedValue(0);
    await expect(
      resolvePayrollPayoutConversion(150_000, 'NGN', 'SOL', { convert }),
    ).rejects.toThrow(/not supported/);
    expect(convert).not.toHaveBeenCalled();
  });

  it('rejects an unknown currency outright', async () => {
    const convert = jest.fn().mockResolvedValue(0);
    await expect(
      resolvePayrollPayoutConversion(150_000, 'NGN', 'XYZ', { convert }),
    ).rejects.toThrow(/Cannot pay NGN salary in XYZ/);
    expect(convert).not.toHaveBeenCalled();
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
