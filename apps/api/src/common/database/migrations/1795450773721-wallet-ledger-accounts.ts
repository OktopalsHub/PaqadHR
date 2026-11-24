import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletLedgerAccounts1795450773721 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_ledger_accounts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          owner_type character varying(16) NOT NULL,
          tenant_id uuid,
          user_id uuid,
          account_type character varying(24) NOT NULL,
          normal_side character varying(6) NOT NULL,
          currency character varying(10) NOT NULL,
          network character varying(32),
          status character varying(16) DEFAULT 'active'::character varying NOT NULL,
          CONSTRAINT ck_wallet_ledger_accounts_normal_side CHECK ((((owner_type)::text = 'system'::text) OR ((normal_side)::text = 'credit'::text))),
          CONSTRAINT ck_wallet_ledger_accounts_owner CHECK (((((owner_type)::text = 'organization'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL) AND ((account_type)::text = ANY ((ARRAY['available'::character varying, 'reserved'::character varying])::text[]))) OR (((owner_type)::text = 'employee'::text) AND (user_id IS NOT NULL) AND (tenant_id IS NULL) AND ((account_type)::text = ANY ((ARRAY['available'::character varying, 'reserved'::character varying])::text[]))) OR (((owner_type)::text = 'system'::text) AND (tenant_id IS NULL) AND (user_id IS NULL) AND ((account_type)::text = ANY ((ARRAY['clearing'::character varying, 'fee'::character varying, 'custody'::character varying, 'revenue'::character varying])::text[]))))),
          CONSTRAINT wallet_ledger_accounts_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['available'::character varying, 'reserved'::character varying, 'clearing'::character varying, 'fee'::character varying, 'custody'::character varying, 'revenue'::character varying])::text[]))),
          CONSTRAINT wallet_ledger_accounts_normal_side_check CHECK (((normal_side)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[]))),
          CONSTRAINT wallet_ledger_accounts_owner_type_check CHECK (((owner_type)::text = ANY ((ARRAY['organization'::character varying, 'employee'::character varying, 'system'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_accounts
          ADD CONSTRAINT wallet_ledger_accounts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_employee ON wallet_ledger_accounts USING btree (user_id, account_type, currency, COALESCE(network, ''::character varying)) WHERE ((owner_type)::text = 'employee'::text);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_org ON wallet_ledger_accounts USING btree (tenant_id, account_type, currency, COALESCE(network, ''::character varying)) WHERE ((owner_type)::text = 'organization'::text);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_system ON wallet_ledger_accounts USING btree (account_type, currency, COALESCE(network, ''::character varying)) WHERE ((owner_type)::text = 'system'::text);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_referenced_wallet_ledger_accounts()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            BEGIN
              IF EXISTS (SELECT 1 FROM wallet_ledger_entries WHERE account_id = OLD.id) THEN
                IF TG_OP = 'DELETE' THEN
                  RAISE EXCEPTION 'Wallet ledger account cannot be deleted after it is referenced';
                END IF;
                IF NEW.owner_type IS DISTINCT FROM OLD.owner_type OR
                   NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
                   NEW.user_id IS DISTINCT FROM OLD.user_id OR
                   NEW.account_type IS DISTINCT FROM OLD.account_type OR
                   NEW.normal_side IS DISTINCT FROM OLD.normal_side OR
                   NEW.currency IS DISTINCT FROM OLD.currency OR
                   NEW.network IS DISTINCT FROM OLD.network THEN
                  RAISE EXCEPTION 'Wallet ledger account identity cannot change after it is referenced';
                END IF;
              END IF;
              IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_protect_referenced_wallet_ledger_accounts BEFORE DELETE OR UPDATE ON wallet_ledger_accounts FOR EACH ROW EXECUTE FUNCTION protect_referenced_wallet_ledger_accounts();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_accounts
          ADD CONSTRAINT wallet_ledger_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_accounts
          ADD CONSTRAINT wallet_ledger_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_ledger_accounts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_ledger_accounts because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_ledger_accounts";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS protect_referenced_wallet_ledger_accounts();`);
  }
}
