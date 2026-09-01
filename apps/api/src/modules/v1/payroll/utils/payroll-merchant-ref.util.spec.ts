import {
  buildPayrollMerchantRef,
  isPayrollMerchantRef,
  parsePayrollMerchantRef,
} from './payroll-merchant-ref.util';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';

describe('payroll-merchant-ref.util', () => {
  it('builds base and retry refs', () => {
    expect(buildPayrollMerchantRef(RUN_ID, ITEM_ID)).toBe(`payroll_${RUN_ID}_${ITEM_ID}`);
    expect(buildPayrollMerchantRef(RUN_ID, ITEM_ID, 2)).toBe(`payroll_${RUN_ID}_${ITEM_ID}_r2`);
  });

  it('parses base and retry refs', () => {
    expect(parsePayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}`)).toEqual({
      payrollRunId: RUN_ID,
      payrollItemId: ITEM_ID,
      retryAttempt: 0,
    });
    expect(parsePayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}_r3`)).toEqual({
      payrollRunId: RUN_ID,
      payrollItemId: ITEM_ID,
      retryAttempt: 3,
    });
  });

  it('validates payroll merchant refs', () => {
    expect(isPayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}`)).toBe(true);
    expect(isPayrollMerchantRef(`payroll_${RUN_ID}_${ITEM_ID}_r1`)).toBe(true);
    expect(isPayrollMerchantRef('wallet_topup')).toBe(false);
  });
});
