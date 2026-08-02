import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsWalletProviderAccounts1784761000000 implements MigrationInterface {
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
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenant_wallets'
            AND column_name = 'nomba_account_ref'
        ) THEN
          EXECUTE '
            UPDATE tenant_wallets
            SET virtual_account_reference = COALESCE(virtual_account_reference, nomba_account_ref),
                virtual_account_provider = COALESCE(virtual_account_provider, ''nomba'')
            WHERE nomba_account_ref IS NOT NULL
          ';
        END IF;
      END
      $$;
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
        DROP COLUMN IF EXISTS virtual_account_name;
    `);
  }
}
