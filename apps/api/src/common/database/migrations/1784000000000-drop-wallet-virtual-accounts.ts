import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWalletVirtualAccounts1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS misdirected_deposits;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_misdirected_deposits_account_number;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenant_wallets_virtual_account_number;`);
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        DROP COLUMN IF EXISTS virtual_account_error,
        DROP COLUMN IF EXISTS virtual_account_provisioned_at,
        DROP COLUMN IF EXISTS virtual_account_status,
        DROP COLUMN IF EXISTS nomba_account_ref,
        DROP COLUMN IF EXISTS virtual_account_bank,
        DROP COLUMN IF EXISTS virtual_account_number;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        ADD COLUMN IF NOT EXISTS virtual_account_number VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_bank VARCHAR,
        ADD COLUMN IF NOT EXISTS nomba_account_ref VARCHAR UNIQUE,
        ADD COLUMN IF NOT EXISTS virtual_account_status VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_provisioned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS virtual_account_error TEXT;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_wallets_virtual_account_number
        ON tenant_wallets(virtual_account_number)
        WHERE virtual_account_number IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS misdirected_deposits (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        account_number VARCHAR NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        reference VARCHAR,
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_misdirected_deposits_account_number
        ON misdirected_deposits(account_number);
    `);
  }
}
