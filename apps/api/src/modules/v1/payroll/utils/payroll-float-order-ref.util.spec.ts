import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';
import {
  buildPayrollFloatOrderRef,
  isPayrollFloatOrderRef,
  parseTenantIdFromPayrollFloatOrderRef,
} from './payroll-float-order-ref.util';

describe('payroll-float-order-ref.util', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('builds a Nomba ref that parses back to the tenant', () => {
    const ref = buildPayrollFloatOrderRef(PaymentProvider.NOMBA, tenantId);
    expect(ref.startsWith('pn_')).toBe(true);
    expect(isPayrollFloatOrderRef(ref)).toBe(true);
    expect(parseTenantIdFromPayrollFloatOrderRef(ref)).toBe(tenantId);
  });

  it('does not collide with wallet top-up prefixes', () => {
    const ref = buildPayrollFloatOrderRef(PaymentProvider.FINCRA, tenantId);
    expect(ref.startsWith('wf_')).toBe(false);
    expect(ref.startsWith('pf_')).toBe(true);
  });
});
