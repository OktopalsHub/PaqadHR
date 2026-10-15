import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenPaymentMethodEncryptedColumns1787866777469 implements MigrationInterface {
  name = 'WidenPaymentMethodEncryptedColumns1787866777469';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_methods
        ALTER COLUMN account_number TYPE VARCHAR(512),
        ALTER COLUMN account_name TYPE VARCHAR(512);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_methods
        ALTER COLUMN account_number TYPE VARCHAR(60),
        ALTER COLUMN account_name TYPE VARCHAR(160);
    `);
  }
}
