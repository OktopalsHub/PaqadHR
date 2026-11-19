import type { MigrationInterface, QueryRunner } from 'typeorm';

const LEDGER_EVENT_TYPES =
  "('funding_received', 'payout_reserved', 'payout_confirmed', 'reservation_released', 'shortfall_approved', 'shortfall_cancelled')";

export class WidenPayrollRunFundingLedgerConstraints1792600000000 implements MigrationInterface {
  name = 'WidenPayrollRunFundingLedgerConstraints1792600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_event_type;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_event_type
        CHECK (event_type IN ${LEDGER_EVENT_TYPES});
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS payroll_run_funding_ledger_amount_check;
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_amount;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_amount CHECK (amount >= 0);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [blocking] = (await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM payroll_run_funding_ledger
       WHERE event_type = 'shortfall_cancelled' OR amount <= 0`,
    )) as Array<{ count: string }>;

    if (Number(blocking.count) > 0) {
      throw new Error(
        'Refusing to narrow payroll_run_funding_ledger constraints because cancellation or zero-amount ' +
          'records exist. Export/archive those rows before rolling this migration back.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_amount;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_amount CHECK (amount > 0);
      ALTER TABLE payroll_run_funding_ledger
        DROP CONSTRAINT IF EXISTS ck_payroll_run_funding_ledger_event_type;
      ALTER TABLE payroll_run_funding_ledger
        ADD CONSTRAINT ck_payroll_run_funding_ledger_event_type
        CHECK (event_type IN ('funding_received', 'payout_reserved', 'payout_confirmed', 'reservation_released', 'shortfall_approved'));
    `);
  }
}
