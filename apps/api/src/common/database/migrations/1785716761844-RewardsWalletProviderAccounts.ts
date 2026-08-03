import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsWalletProviderAccounts1785716761844 implements MigrationInterface {
  name = 'RewardsWalletProviderAccounts1785716761844';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        ADD COLUMN IF NOT EXISTS virtual_account_number VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_bank VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_name VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_reference VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_provider VARCHAR(24),
        ADD COLUMN IF NOT EXISTS virtual_account_status VARCHAR,
        ADD COLUMN IF NOT EXISTS virtual_account_provisioned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS virtual_account_error TEXT;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_wallets_virtual_account_reference
        ON tenant_wallets(virtual_account_reference)
        WHERE virtual_account_reference IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_wallets_virtual_account_number_unique
        ON tenant_wallets(virtual_account_number)
        WHERE virtual_account_number IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_tenant_wallets_virtual_account_number_unique;`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenant_wallets_virtual_account_reference;`);
    await queryRunner.query(`
      ALTER TABLE tenant_wallets
        DROP COLUMN IF EXISTS virtual_account_error,
        DROP COLUMN IF EXISTS virtual_account_provisioned_at,
        DROP COLUMN IF EXISTS virtual_account_status,
        DROP COLUMN IF EXISTS virtual_account_provider,
        DROP COLUMN IF EXISTS virtual_account_reference,
        DROP COLUMN IF EXISTS virtual_account_name,
        DROP COLUMN IF EXISTS virtual_account_bank,
        DROP COLUMN IF EXISTS virtual_account_number;
    `);
  }
}
