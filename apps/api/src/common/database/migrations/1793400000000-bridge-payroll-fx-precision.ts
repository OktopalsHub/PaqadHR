import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BridgePayrollFxPrecision1793400000000 implements MigrationInterface {
  name = 'BridgePayrollFxPrecision1793400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE payroll_items ALTER COLUMN exchange_rate TYPE numeric(18, 12)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE payroll_items ALTER COLUMN exchange_rate TYPE numeric(10, 6)',
    );
  }
}
