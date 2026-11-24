import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustodyWallets1795450595225 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE custody_wallets (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          owner_type character varying(16) NOT NULL,
          tenant_id uuid,
          user_id uuid,
          provider_customer_id uuid NOT NULL,
          provider character varying(24) NOT NULL,
          provider_wallet_id character varying(255) NOT NULL,
          network character varying(32) NOT NULL,
          address character varying(255),
          status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
          metadata jsonb,
          CONSTRAINT ck_custody_wallets_owner CHECK (((((owner_type)::text = 'organization'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL)) OR (((owner_type)::text = 'employee'::text) AND (user_id IS NOT NULL) AND (tenant_id IS NULL)))),
          CONSTRAINT custody_wallets_owner_type_check CHECK (((owner_type)::text = ANY ((ARRAY['organization'::character varying, 'employee'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custody_wallets
          ADD CONSTRAINT custody_wallets_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custody_wallets
          ADD CONSTRAINT uq_custody_wallets_provider_wallet UNIQUE (provider, provider_wallet_id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_custody_wallets_employee ON custody_wallets USING btree (user_id, created_at) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_custody_wallets_org ON custody_wallets USING btree (tenant_id, created_at) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_custody_wallets_employee_chain ON custody_wallets USING btree (user_id, provider, network) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_custody_wallets_org_chain ON custody_wallets USING btree (tenant_id, provider, network) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_custody_wallet_customer_owner()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE customer wallet_provider_customers%ROWTYPE;
            BEGIN
              SELECT * INTO customer FROM wallet_provider_customers WHERE id = NEW.provider_customer_id;
              IF customer.id IS NULL OR
                 customer.owner_type IS DISTINCT FROM NEW.owner_type OR
                 customer.tenant_id IS DISTINCT FROM NEW.tenant_id OR
                 customer.user_id IS DISTINCT FROM NEW.user_id OR
                 customer.provider IS DISTINCT FROM NEW.provider THEN
                RAISE EXCEPTION 'Custody wallet owner and provider must match its provider customer';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_custody_wallet_customer_owner BEFORE INSERT OR UPDATE ON custody_wallets FOR EACH ROW EXECUTE FUNCTION enforce_custody_wallet_customer_owner();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custody_wallets
          ADD CONSTRAINT custody_wallets_provider_customer_id_fkey FOREIGN KEY (provider_customer_id) REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custody_wallets
          ADD CONSTRAINT custody_wallets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custody_wallets
          ADD CONSTRAINT custody_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM custody_wallets',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop custody_wallets because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "custody_wallets";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_custody_wallet_customer_owner();`);
  }
}
