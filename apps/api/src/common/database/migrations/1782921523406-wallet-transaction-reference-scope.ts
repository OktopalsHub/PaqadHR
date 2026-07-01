import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletTransactionReferenceScope1782921523406 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_wallet_transactions
        DROP CONSTRAINT IF EXISTS tenant_wallet_transactions_reference_key;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_wallet_reference
        ON tenant_wallet_transactions(tenant_wallet_id, reference)
        WHERE reference IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_wallet_tx_wallet_reference;`);
    await queryRunner.query(`
      ALTER TABLE tenant_wallet_transactions
        ADD CONSTRAINT tenant_wallet_transactions_reference_key UNIQUE (reference);
    `);
  }
}
