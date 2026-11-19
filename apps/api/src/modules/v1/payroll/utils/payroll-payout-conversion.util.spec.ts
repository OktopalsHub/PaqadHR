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

  it('rejects NGN cross-currency routes because Bridge has no NGN FX', async () => {
    const convert = jest.fn().mockResolvedValue(0);
    await expect(
      resolvePayrollPayoutConversion(150_000, 'NGN', 'USDT', { convert }),
    ).rejects.toThrow(/Bridge FX for NGN is not available/);
    expect(convert).not.toHaveBeenCalled();
  });

  it('rejects an unsupported native-asset payout instead of quoting a rate that cannot exist', async () => {
    // There is no NGN→SOL rate. Falling through to the fiat converter would silently
    // produce a bogus amount that then gets paid out.
    const convert = jest.fn().mockResolvedValue(0);
    await expect(
      resolvePayrollPayoutConversion(150_000, 'USD', 'SOL', { convert }),
    ).rejects.toThrow(/not supported/);
    expect(convert).not.toHaveBeenCalled();
  });

  it('rejects an unknown currency outright', async () => {
    const convert = jest.fn().mockResolvedValue(0);
    await expect(
      resolvePayrollPayoutConversion(150_000, 'USD', 'XYZ', { convert }),
    ).rejects.toThrow(/Cannot pay USD salary in XYZ/);
    expect(convert).not.toHaveBeenCalled();
  });

  it('converts fiat salary to fiat payout', async () => {
    const fiatExchange: FiatExchangeConvert = {
      convert: async (amount: number) => amount * 0.65,
    };
    const result = await resolvePayrollPayoutConversion(100, 'USD', 'EUR', fiatExchange);
    expect(result.fxAtPayout).toBe(false);
    expect(result.paymentAmount).toBe(65);
    expect(result.exchangeRate).toBeCloseTo(0.65);
  });
});
