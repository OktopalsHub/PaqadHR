import {
  buildPayrollMerchantRef,
  isPayrollMerchantRef,
  parsePayrollMerchantRef,
} from './payroll-merchant-ref.util';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';

describe('payroll-merchant-ref.util', () => {
  it('builds compact Monnify-safe refs under 64 chars', () => {
    const base = buildPayrollMerchantRef(RUN_ID, ITEM_ID);
    const retry = buildPayrollMerchantRef(RUN_ID, ITEM_ID, 2);
    expect(base).toBe('pi_22222222222242228222222222222222');
    expect(retry).toBe('pi_22222222222242228222222222222222_r2');
    expect(base.length).toBeLessThanOrEqual(64);
    expect(retry.length).toBeLessThanOrEqual(64);
  });

  it('parses compact and legacy refs', () => {
    expect(parsePayrollMerchantRef(buildPayrollMerchantRef(RUN_ID, ITEM_ID))).toEqual({
      payrollRunId: null,
      payrollItemId: ITEM_ID,
      retryAttempt: 0,
    });
    expect(parsePayrollMerchantRef(buildPayrollMerchantRef(RUN_ID, ITEM_ID, 3))).toEqual({
      payrollRunId: null,
      payrollItemId: ITEM_ID,
      retryAttempt: 3,
    });
    expect(parsePayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}`)).toEqual({
      payrollRunId: RUN_ID,
      payrollItemId: ITEM_ID,
      retryAttempt: 0,
    });
  });

  it('validates payroll merchant refs', () => {
    expect(isPayrollMerchantRef(buildPayrollMerchantRef(RUN_ID, ITEM_ID))).toBe(true);
    expect(isPayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}_r1`)).toBe(true);
    expect(isPayrollMerchantRef('wallet_topup')).toBe(false);
  });
});
