import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantWallets1795450768525 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_wallets (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          currency_code character varying(8) DEFAULT 'NGN'::character varying,
          balance_amount numeric(14,2) DEFAULT 0,
          points_exchange_rate numeric(10,2) DEFAULT 10,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          auto_topup_enabled boolean DEFAULT false NOT NULL,
          auto_topup_threshold numeric(14,2) DEFAULT 0 NOT NULL,
          auto_topup_amount numeric(14,2) DEFAULT 0 NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_wallets
          ADD CONSTRAINT tenant_wallets_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_wallets
          ADD CONSTRAINT tenant_wallets_tenant_id_key UNIQUE (tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_wallets_tenant_id ON tenant_wallets USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_wallets
          ADD CONSTRAINT fk_tenant_wallets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_wallets";`);
  }
}
