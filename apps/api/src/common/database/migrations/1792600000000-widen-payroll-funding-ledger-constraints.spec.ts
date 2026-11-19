import { WidenPayrollRunFundingLedgerConstraints1792600000000 } from './1792600000000-widen-payroll-funding-ledger-constraints';

describe('WidenPayrollRunFundingLedgerConstraints1792600000000', () => {
  const migration = new WidenPayrollRunFundingLedgerConstraints1792600000000();

  it('allows the cancellation event type and zero-amount cancellation rows', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await migration.up(queryRunner as never);

    const sql = queryRunner.query.mock.calls[0][0] as string;
    expect(sql).toContain("'shortfall_cancelled'");
    expect(sql).toContain('CHECK (amount >= 0)');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS payroll_run_funding_ledger_amount_check');
  });

  it('refuses to narrow the constraints while cancellation rows exist', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValueOnce([{ count: '2' }]) };

    await expect(migration.down(queryRunner as never)).rejects.toThrow(
      'Refusing to narrow payroll_run_funding_ledger constraints',
    );
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });
});
