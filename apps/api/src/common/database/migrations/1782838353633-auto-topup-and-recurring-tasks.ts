import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoTopupAndRecurringTasks1782838353633 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rewards_tasks
      ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await queryRunner.query(`
      ALTER TABLE tenant_wallets
      ADD COLUMN IF NOT EXISTS auto_topup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS auto_topup_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS auto_topup_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
      DROP COLUMN IF EXISTS auto_topup_enabled,
      DROP COLUMN IF EXISTS auto_topup_threshold,
      DROP COLUMN IF EXISTS auto_topup_amount;
    `);

    await queryRunner.query(`
      ALTER TABLE rewards_tasks
      DROP COLUMN IF EXISTS is_recurring;
    `);
  }
}
