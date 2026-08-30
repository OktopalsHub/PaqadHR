import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveBalanceDeletedAt1787874000000 implements MigrationInterface {
  name = 'AddLeaveBalanceDeletedAt1787874000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leave_balances ADD COLUMN deleted_at TIMESTAMP NULL;');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leave_balances DROP COLUMN deleted_at;');
  }
}
