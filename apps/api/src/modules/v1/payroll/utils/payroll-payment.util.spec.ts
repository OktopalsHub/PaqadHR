import { resolveBachsUsdBankAddress, resolvePayrollPayoutAmount } from './payroll-payment.util';

describe('resolveBachsUsdBankAddress', () => {
  const usHome = {
    street: '1 Main St',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  };

  it('prefers a saved US bank address', () => {
    expect(
      resolveBachsUsdBankAddress(
        {
          bachsBankAddress: {
            line1: '100 Bank St',
            city: 'Charlotte',
            state: 'NC',
            postalCode: '28255',
            country: 'US',
          },
        },
        usHome,
      ),
    ).toEqual({
      line1: '100 Bank St',
      city: 'Charlotte',
      state: 'NC',
      postalCode: '28255',
      country: 'US',
    });
  });

  it('falls back to a US home address when the saved address is non-US', () => {
    expect(
      resolveBachsUsdBankAddress(
        {
          bachsBankAddress: {
            line1: '12 Broad St',
            city: 'Lagos',
            state: 'LA',
            postalCode: '100001',
            country: 'NG',
          },
        },
        usHome,
      ),
    ).toEqual({
      line1: '1 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    });
  });

  it('returns undefined when neither address is a usable US bank address', () => {
    expect(
      resolveBachsUsdBankAddress(
        {
          bachsBankAddress: {
            line1: '12 Broad St',
            city: 'Lagos',
            state: 'LA',
            postalCode: '100001',
            country: 'NG',
          },
        },
        { ...usHome, country: 'NG' },
      ),
    ).toBeUndefined();
  });
});

describe('resolvePayrollPayoutAmount', () => {
  it('uses paymentAmount when set', () => {
    expect(resolvePayrollPayoutAmount({ paymentAmount: 1500, netAmount: 900 } as never)).toBe(1500);
  });

  it('falls back to netAmount when paymentAmount is zero decimal string', () => {
    expect(
      resolvePayrollPayoutAmount({
        paymentAmount: '0.00000000',
        netAmount: '2500.00',
      } as never),
    ).toBe(2500);
  });

  it('uses salary net for fx-at-payout rows', () => {
    expect(
      resolvePayrollPayoutAmount({
        paymentAmount: 0,
        netAmount: 250_000,
        metadata: { fxAtPayout: true },
      } as never),
    ).toBe(250_000);
  });

  it('returns 0 when both amounts are empty', () => {
    expect(resolvePayrollPayoutAmount({ paymentAmount: 0, netAmount: 0 } as never)).toBe(0);
  });
});
