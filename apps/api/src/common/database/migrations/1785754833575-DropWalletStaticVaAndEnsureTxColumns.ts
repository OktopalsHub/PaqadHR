import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWalletStaticVaAndEnsureTxColumns1785754833575 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        DROP COLUMN IF EXISTS virtual_account_number,
        DROP COLUMN IF EXISTS virtual_account_bank;
    `);

    await queryRunner.query(`
      ALTER TABLE tenant_wallet_transactions
        ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'COMPLETED',
        ADD COLUMN IF NOT EXISTS raw_amount NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR,
        ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallet_transactions
        DROP COLUMN IF EXISTS metadata,
        DROP COLUMN IF EXISTS provider_event_id,
        DROP COLUMN IF EXISTS raw_amount,
        DROP COLUMN IF EXISTS status;
    `);

    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        ADD COLUMN IF NOT EXISTS virtual_account_number VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_bank VARCHAR;
    `);
  }
}
