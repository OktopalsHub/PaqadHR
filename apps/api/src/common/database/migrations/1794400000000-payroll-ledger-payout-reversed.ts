import type { MigrationInterface, QueryRunner } from 'typeorm';

const WITH_REVERSED =
  "('funding_received', 'payout_reserved', 'payout_confirmed', 'payout_reversed', 'reservation_released', 'shortfall_approved', 'shortfall_cancelled')";
const WITHOUT_REVERSED =
  "('funding_received', 'payout_reserved', 'payout_confirmed', 'reservation_released', 'shortfall_approved', 'shortfall_cancelled')";

export class PayrollLedgerPayoutReversed1794400000000 implements MigrationInterface {
  name = 'PayrollLedgerPayoutReversed1794400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_event_type;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_event_type
        CHECK (event_type IN ${WITH_REVERSED});
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [blocking] = (await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM payroll_run_funding_ledger WHERE event_type = 'payout_reversed'`,
    )) as Array<{ count: string }>;
    if (Number(blocking.count) > 0) {
      throw new Error(
        'Refusing to remove payout_reversed from the ledger constraint while reversal rows exist. Archive them first.',
      );
    }
    await queryRunner.query(`
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_event_type;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_event_type
        CHECK (event_type IN ${WITHOUT_REVERSED});
    `);
  }
}
