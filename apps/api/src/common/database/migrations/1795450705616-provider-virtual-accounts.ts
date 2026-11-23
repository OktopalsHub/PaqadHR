import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderVirtualAccounts1795450705616 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE provider_virtual_accounts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          owner_type character varying(16) NOT NULL,
          tenant_id uuid,
          user_id uuid,
          provider_customer_id uuid NOT NULL,
          custody_wallet_id uuid NOT NULL,
          provider character varying(24) NOT NULL,
          provider_virtual_account_id character varying(255) NOT NULL,
          source_currency character varying(10) NOT NULL,
          destination_currency character varying(10) NOT NULL,
          network character varying(32) NOT NULL,
          status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
          CONSTRAINT ck_provider_virtual_accounts_owner CHECK (((((owner_type)::text = 'organization'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL)) OR (((owner_type)::text = 'employee'::text) AND (user_id IS NOT NULL) AND (tenant_id IS NULL)))),
          CONSTRAINT provider_virtual_accounts_destination_currency_check CHECK (((destination_currency)::text = ANY ((ARRAY['USDC'::character varying, 'USDT'::character varying])::text[]))),
          CONSTRAINT provider_virtual_accounts_owner_type_check CHECK (((owner_type)::text = ANY ((ARRAY['organization'::character varying, 'employee'::character varying])::text[]))),
          CONSTRAINT provider_virtual_accounts_source_currency_check CHECK (((source_currency)::text = ANY ((ARRAY['USD'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'NGN'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT provider_virtual_accounts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT uq_provider_virtual_accounts_provider_id UNIQUE (provider, provider_virtual_account_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT uq_provider_virtual_accounts_route UNIQUE (provider_customer_id, source_currency, destination_currency, network);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_provider_virtual_accounts_employee ON provider_virtual_accounts USING btree (user_id, created_at) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_provider_virtual_accounts_org ON provider_virtual_accounts USING btree (tenant_id, created_at) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_provider_virtual_account_ownership()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE customer wallet_provider_customers%ROWTYPE;
            DECLARE custody custody_wallets%ROWTYPE;
            BEGIN
              SELECT * INTO customer FROM wallet_provider_customers WHERE id = NEW.provider_customer_id;
              SELECT * INTO custody FROM custody_wallets WHERE id = NEW.custody_wallet_id;
              IF customer.id IS NULL OR custody.id IS NULL OR
                 customer.owner_type IS DISTINCT FROM NEW.owner_type OR
                 customer.tenant_id IS DISTINCT FROM NEW.tenant_id OR
                 customer.user_id IS DISTINCT FROM NEW.user_id OR
                 customer.provider IS DISTINCT FROM NEW.provider OR
                 custody.owner_type IS DISTINCT FROM NEW.owner_type OR
                 custody.tenant_id IS DISTINCT FROM NEW.tenant_id OR
                 custody.user_id IS DISTINCT FROM NEW.user_id OR
                 custody.provider IS DISTINCT FROM NEW.provider OR
                 custody.provider_customer_id IS DISTINCT FROM NEW.provider_customer_id OR
                 custody.network IS DISTINCT FROM NEW.network THEN
                RAISE EXCEPTION 'Virtual account owner, provider, wallet, and network must match';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_provider_virtual_account_ownership BEFORE INSERT OR UPDATE ON provider_virtual_accounts FOR EACH ROW EXECUTE FUNCTION enforce_provider_virtual_account_ownership();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT provider_virtual_accounts_custody_wallet_id_fkey FOREIGN KEY (custody_wallet_id) REFERENCES custody_wallets(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT provider_virtual_accounts_provider_customer_id_fkey FOREIGN KEY (provider_customer_id) REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT provider_virtual_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_virtual_accounts
          ADD CONSTRAINT provider_virtual_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM provider_virtual_accounts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop provider_virtual_accounts because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_virtual_accounts";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_provider_virtual_account_ownership();`);
  }
}
