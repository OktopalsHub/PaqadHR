import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletProviderCustomers1795450592425 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_provider_customers (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          owner_type character varying(16) NOT NULL,
          tenant_id uuid,
          user_id uuid,
          provider character varying(24) NOT NULL,
          provider_customer_id character varying(255),
          provider_kyc_link_id character varying(255),
          status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
          kyc_status character varying(24),
          kyb_status character varying(24),
          terms_status character varying(24),
          metadata jsonb,
          CONSTRAINT ck_wallet_provider_customers_owner CHECK (((((owner_type)::text = 'organization'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL)) OR (((owner_type)::text = 'employee'::text) AND (user_id IS NOT NULL) AND (tenant_id IS NULL)))),
          CONSTRAINT wallet_provider_customers_owner_type_check CHECK (((owner_type)::text = ANY ((ARRAY['organization'::character varying, 'employee'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_customers
          ADD CONSTRAINT uq_wallet_provider_customers_kyc_link UNIQUE (provider, provider_kyc_link_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_customers
          ADD CONSTRAINT uq_wallet_provider_customers_provider_customer UNIQUE (provider, provider_customer_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_customers
          ADD CONSTRAINT wallet_provider_customers_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_provider_customers_employee_provider ON wallet_provider_customers USING btree (user_id, provider) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_provider_customers_org_provider ON wallet_provider_customers USING btree (tenant_id, provider) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_customers
          ADD CONSTRAINT wallet_provider_customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_customers
          ADD CONSTRAINT wallet_provider_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_provider_customers',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_provider_customers because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_provider_customers";`);
  }
}
