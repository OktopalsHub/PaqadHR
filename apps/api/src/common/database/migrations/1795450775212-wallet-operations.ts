import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletOperations1795450775212 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_operations (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          payroll_run_id uuid,
          payroll_item_id uuid,
          source_wallet_id uuid,
          destination_wallet_id uuid,
          provider character varying(24) NOT NULL,
          kind character varying(24) NOT NULL,
          status character varying(24) DEFAULT 'created'::character varying NOT NULL,
          source_amount numeric(30,12) NOT NULL,
          source_currency character varying(10) NOT NULL,
          destination_amount numeric(30,12),
          destination_currency character varying(10),
          network character varying(32),
          exchange_rate numeric(30,12),
          provider_reference character varying(255),
          idempotency_key character varying(255) NOT NULL,
          metadata jsonb,
          CONSTRAINT wallet_operations_destination_amount_check CHECK (((destination_amount IS NULL) OR (destination_amount > (0)::numeric))),
          CONSTRAINT wallet_operations_exchange_rate_check CHECK (((exchange_rate IS NULL) OR (exchange_rate > (0)::numeric))),
          CONSTRAINT wallet_operations_kind_check CHECK (((kind)::text = ANY ((ARRAY['funding'::character varying, 'transfer'::character varying, 'withdrawal'::character varying, 'conversion'::character varying])::text[]))),
          CONSTRAINT wallet_operations_source_amount_check CHECK ((source_amount > (0)::numeric))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_idempotency_key_key UNIQUE (idempotency_key);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_operations_payroll_run ON wallet_operations USING btree (payroll_run_id, created_at) WHERE (payroll_run_id IS NOT NULL);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_operations_tenant_created ON wallet_operations USING btree (tenant_id, created_at);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_operations_provider_ref ON wallet_operations USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_destination_wallet_id_fkey FOREIGN KEY (destination_wallet_id) REFERENCES custody_wallets(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_payroll_item_id_fkey FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_source_wallet_id_fkey FOREIGN KEY (source_wallet_id) REFERENCES custody_wallets(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_operations
          ADD CONSTRAINT wallet_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_operations',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_operations because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_operations";`);
  }
}
