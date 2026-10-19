import { PayrollRunFundingLedger1792000000000 } from './1792000000000-payroll-run-funding-ledger';

describe('PayrollRunFundingLedger1792000000000', () => {
  const migration = new PayrollRunFundingLedger1792000000000();

  it('prevents deleting financial audit records when a rollback is attempted', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValueOnce([{ count: '3' }]),
    };

    await expect(migration.down(queryRunner as never)).rejects.toThrow(
      'Refusing to drop payroll_run_funding_ledger because it contains financial audit records',
    );
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith(
      'SELECT COUNT(*)::text AS count FROM payroll_run_funding_ledger',
    );
  });

  it('allows rollback only when the ledger is empty', async () => {
    const queryRunner = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce(undefined),
    };

    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'DROP TABLE IF EXISTS payroll_run_funding_ledger',
    );
  });

  it('uses restrictive foreign keys so deleting a run or tenant cannot cascade-delete ledger history', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await migration.up(queryRunner as never);

    const sql = queryRunner.query.mock.calls[0][0] as string;
    expect(sql).toContain('REFERENCES payroll_runs(id) ON DELETE RESTRICT');
    expect(sql).toContain('REFERENCES tenants(id) ON DELETE RESTRICT');
  });
});
