import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantWalletTransactions1795450769440 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_wallet_transactions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_wallet_id uuid NOT NULL,
          type character varying(16) NOT NULL,
          amount numeric(14,2) NOT NULL,
          reference character varying,
          description text,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          status character varying DEFAULT 'COMPLETED'::character varying,
          raw_amount numeric(14,2),
          provider_event_id character varying,
          metadata jsonb
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_wallet_transactions
          ADD CONSTRAINT tenant_wallet_transactions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_wallet_tx_wallet_id ON tenant_wallet_transactions USING btree (tenant_wallet_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_wallet_tx_wallet_reference ON tenant_wallet_transactions USING btree (tenant_wallet_id, reference) WHERE (reference IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_wallet_transactions
          ADD CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (tenant_wallet_id) REFERENCES tenant_wallets(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_wallet_transactions";`);
  }
}
