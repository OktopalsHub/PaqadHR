import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollPayoutModeAndEmploymentCurrency1784756934802 implements MigrationInterface {
  name = 'PayrollPayoutModeAndEmploymentCurrency1784756934802';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payroll_runs
        ADD COLUMN IF NOT EXISTS payout_mode VARCHAR(16) NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE employment
        ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NULL;
    `);
    await queryRunner.query(`
      UPDATE employment e
      SET currency = COALESCE(UPPER(t.preferred_currency), 'USD')
      FROM tenants t
      WHERE e.tenant_id = t.id
        AND e.currency IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE employment
        ALTER COLUMN currency SET DEFAULT 'USD';
    `);
    await queryRunner.query(`
      UPDATE employment SET currency = 'USD' WHERE currency IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE employment
        ALTER COLUMN currency SET NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payroll_runs DROP COLUMN IF EXISTS payout_mode;
    `);
    await queryRunner.query(`
      ALTER TABLE employment DROP COLUMN IF EXISTS currency;
    `);
  }
}
