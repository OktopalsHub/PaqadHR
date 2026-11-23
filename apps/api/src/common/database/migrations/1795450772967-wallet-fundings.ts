import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletFundings1795450772967 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_fundings (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          owner_type character varying(16) NOT NULL,
          tenant_id uuid,
          user_id uuid,
          virtual_account_id uuid NOT NULL,
          provider character varying(24) NOT NULL,
          provider_deposit_id character varying(255) NOT NULL,
          status character varying(24) NOT NULL,
          source_amount numeric(30,12),
          source_currency character varying(10) NOT NULL,
          destination_amount numeric(30,12),
          destination_currency character varying(10) NOT NULL,
          network character varying(32) NOT NULL,
          occurred_at timestamp without time zone NOT NULL,
          ledger_transaction_id uuid,
          reversal_transaction_id uuid,
          CONSTRAINT ck_wallet_fundings_owner CHECK (((((owner_type)::text = 'organization'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL)) OR (((owner_type)::text = 'employee'::text) AND (user_id IS NOT NULL) AND (tenant_id IS NULL)))),
          CONSTRAINT wallet_fundings_destination_amount_check CHECK (((destination_amount IS NULL) OR (destination_amount > (0)::numeric))),
          CONSTRAINT wallet_fundings_owner_type_check CHECK (((owner_type)::text = ANY ((ARRAY['organization'::character varying, 'employee'::character varying])::text[]))),
          CONSTRAINT wallet_fundings_source_amount_check CHECK (((source_amount IS NULL) OR (source_amount > (0)::numeric))),
          CONSTRAINT wallet_fundings_status_check CHECK (((status)::text = ANY ((ARRAY['funds_received'::character varying, 'in_review'::character varying, 'payment_submitted'::character varying, 'payment_processed'::character varying, 'refund_in_flight'::character varying, 'refunded'::character varying, 'refund_failed'::character varying, 'unknown'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT uq_wallet_fundings_provider_deposit UNIQUE (provider, virtual_account_id, provider_deposit_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_fundings_employee_created ON wallet_fundings USING btree (user_id, created_at) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_fundings_org_created ON wallet_fundings USING btree (tenant_id, created_at) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_wallet_funding_virtual_account_owner()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE virtual_account provider_virtual_accounts%ROWTYPE;
            BEGIN
              SELECT * INTO virtual_account FROM provider_virtual_accounts WHERE id = NEW.virtual_account_id;
              IF virtual_account.id IS NULL OR
                 virtual_account.owner_type IS DISTINCT FROM NEW.owner_type OR
                 virtual_account.tenant_id IS DISTINCT FROM NEW.tenant_id OR
                 virtual_account.user_id IS DISTINCT FROM NEW.user_id OR
                 virtual_account.provider IS DISTINCT FROM NEW.provider OR
                 virtual_account.source_currency IS DISTINCT FROM NEW.source_currency OR
                 virtual_account.destination_currency IS DISTINCT FROM NEW.destination_currency OR
                 virtual_account.network IS DISTINCT FROM NEW.network THEN
                RAISE EXCEPTION 'Wallet funding owner and route must match its virtual account';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_wallet_funding_virtual_account_owner BEFORE INSERT OR UPDATE ON wallet_fundings FOR EACH ROW EXECUTE FUNCTION enforce_wallet_funding_virtual_account_owner();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_ledger_transaction_id_fkey FOREIGN KEY (ledger_transaction_id) REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_reversal_transaction_id_fkey FOREIGN KEY (reversal_transaction_id) REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_fundings
          ADD CONSTRAINT wallet_fundings_virtual_account_id_fkey FOREIGN KEY (virtual_account_id) REFERENCES provider_virtual_accounts(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_fundings',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_fundings because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_fundings";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_wallet_funding_virtual_account_owner();`);
  }
}
