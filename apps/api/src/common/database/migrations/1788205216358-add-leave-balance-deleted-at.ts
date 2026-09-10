import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveBalanceDeletedAt1788205216358 implements MigrationInterface {
  name = 'AddLeaveBalanceDeletedAt1788205216358';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leave_balances ADD COLUMN deleted_at TIMESTAMP NULL;');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leave_balances DROP COLUMN deleted_at;');
  }
}
