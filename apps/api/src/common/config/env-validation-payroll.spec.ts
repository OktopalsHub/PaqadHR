import { collectPayrollErrors } from './env-validation-rules';

describe('collectPayrollErrors', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('passes with no payroll configuration', () => {
    delete process.env.BRIDGE_PAYROLL_CAPABILITIES;
    delete process.env.NOMBA_PAYROLL_NGN_ENABLED;
    expect(collectPayrollErrors()).toEqual([]);
  });

  it('rejects malformed Bridge capabilities', () => {
    process.env.BRIDGE_PAYROLL_CAPABILITIES = '{not json';
    expect(collectPayrollErrors()).toHaveLength(1);
  });

  it('requires a confirmed fee before Nomba NGN payroll is enabled', () => {
    process.env.NOMBA_PAYROLL_NGN_ENABLED = 'true';
    delete process.env.PAYROLL_PAYOUT_FEE_NOMBA_NGN;
    expect(collectPayrollErrors()).toHaveLength(1);
    process.env.PAYROLL_PAYOUT_FEE_NOMBA_NGN = '53.75';
    expect(collectPayrollErrors()).toEqual([]);
  });
});
