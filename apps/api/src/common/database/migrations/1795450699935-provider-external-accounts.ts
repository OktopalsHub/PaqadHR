import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderExternalAccounts1795450699935 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE provider_external_accounts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          member_id uuid NOT NULL,
          user_id uuid NOT NULL,
          payment_method_id uuid NOT NULL,
          provider_customer_id uuid NOT NULL,
          provider character varying(24) NOT NULL,
          provider_external_account_id character varying(255) CONSTRAINT provider_external_accounts_provider_external_account_i_not_null NOT NULL,
          currency character varying(10) NOT NULL,
          country character varying(2) NOT NULL,
          source_currency character varying(10) NOT NULL,
          network character varying(32) NOT NULL,
          status character varying(24) NOT NULL,
          fingerprint character varying(64) NOT NULL,
          CONSTRAINT provider_external_accounts_country_check CHECK (((country)::text ~ '^[A-Z]{2}$'::text)),
          CONSTRAINT provider_external_accounts_currency_check CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'EUR'::character varying, 'GBP'::character varying])::text[]))),
          CONSTRAINT provider_external_accounts_provider_check CHECK (((provider)::text = 'bridge'::text)),
          CONSTRAINT provider_external_accounts_source_currency_check CHECK (((source_currency)::text = ANY ((ARRAY['USDC'::character varying, 'USDT'::character varying])::text[]))),
          CONSTRAINT provider_external_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'inactive'::character varying, 'rejected'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT provider_external_accounts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT uq_provider_external_accounts_method UNIQUE (payment_method_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT uq_provider_external_accounts_provider_id UNIQUE (provider, provider_external_account_id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_provider_external_accounts_owner ON provider_external_accounts USING btree (tenant_id, user_id, currency);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_bridge_external_account_owner()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE member_user_id uuid;
            DECLARE customer wallet_provider_customers%ROWTYPE;
            BEGIN
              SELECT user_id INTO member_user_id FROM tenant_members
                WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
              SELECT * INTO customer FROM wallet_provider_customers
                WHERE id = NEW.provider_customer_id;
              IF member_user_id IS DISTINCT FROM NEW.user_id OR customer.id IS NULL OR
                 customer.provider IS DISTINCT FROM 'bridge' OR
                 customer.owner_type IS DISTINCT FROM 'employee' OR
                 customer.user_id IS DISTINCT FROM NEW.user_id OR customer.tenant_id IS NOT NULL THEN
                RAISE EXCEPTION 'Bridge external account owner does not match employee and payment method';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_bridge_external_account_owner BEFORE INSERT OR UPDATE ON provider_external_accounts FOR EACH ROW EXECUTE FUNCTION enforce_bridge_external_account_owner();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT fk_provider_external_accounts_method_owner FOREIGN KEY (payment_method_id, tenant_id, member_id) REFERENCES payment_methods(id, tenant_id, member_id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT provider_external_accounts_member_id_fkey FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT provider_external_accounts_provider_customer_id_fkey FOREIGN KEY (provider_customer_id) REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT provider_external_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY provider_external_accounts
          ADD CONSTRAINT provider_external_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM provider_external_accounts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop provider_external_accounts because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_external_accounts";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_bridge_external_account_owner();`);
  }
}
