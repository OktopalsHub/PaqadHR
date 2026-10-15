import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollRunUniquePerCurrency1788305216359 implements MigrationInterface {
  name = 'PayrollRunUniquePerCurrency1788305216359';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS uk_payroll_runs_tenant_period;`,
    );
    await queryRunner.query(
      `ALTER TABLE payroll_runs ADD CONSTRAINT uk_payroll_runs_tenant_period_currency UNIQUE (tenant_id, period_start, period_end, base_currency);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS uk_payroll_runs_tenant_period_currency;`,
    );
    await queryRunner.query(
      `ALTER TABLE payroll_runs ADD CONSTRAINT uk_payroll_runs_tenant_period UNIQUE (tenant_id, period_start, period_end);`,
    );
  }
}
