import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletLedgerEntries1795450774472 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_ledger_entries (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          transaction_id uuid NOT NULL,
          account_id uuid NOT NULL,
          direction character varying(6) NOT NULL,
          amount numeric(30,12) NOT NULL,
          currency character varying(10) NOT NULL,
          CONSTRAINT wallet_ledger_entries_amount_check CHECK ((amount > (0)::numeric)),
          CONSTRAINT wallet_ledger_entries_direction_check CHECK (((direction)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_entries
          ADD CONSTRAINT wallet_ledger_entries_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_ledger_entries_account_created ON wallet_ledger_entries USING btree (account_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_ledger_entries_transaction ON wallet_ledger_entries USING btree (transaction_id);
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_wallet_ledger_entry_account_currency()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE account_currency varchar(10);
            BEGIN
              SELECT currency INTO account_currency FROM wallet_ledger_accounts WHERE id = NEW.account_id;
              IF account_currency IS NULL OR account_currency <> NEW.currency THEN
                RAISE EXCEPTION 'Wallet ledger entry currency must match its account';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_posted_wallet_ledger_entries()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE entry_status varchar(16);
            BEGIN
              IF TG_OP = 'DELETE' THEN
                SELECT status INTO entry_status FROM wallet_ledger_transactions WHERE id = OLD.transaction_id;
                IF entry_status IN ('posted', 'reversed') THEN
                  RAISE EXCEPTION 'Posted wallet ledger entries are immutable';
                END IF;
                RETURN OLD;
              ELSIF TG_OP = 'INSERT' THEN
                SELECT status INTO entry_status FROM wallet_ledger_transactions WHERE id = NEW.transaction_id;
              ELSE
                SELECT status INTO entry_status FROM wallet_ledger_transactions WHERE id = OLD.transaction_id;
                IF entry_status NOT IN ('posted', 'reversed') AND NEW.transaction_id <> OLD.transaction_id THEN
                  SELECT status INTO entry_status FROM wallet_ledger_transactions WHERE id = NEW.transaction_id;
                END IF;
              END IF;
              IF entry_status IN ('posted', 'reversed') THEN
                RAISE EXCEPTION 'Posted wallet ledger entries are immutable';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_protect_posted_wallet_ledger_entries BEFORE INSERT OR DELETE OR UPDATE ON wallet_ledger_entries FOR EACH ROW EXECUTE FUNCTION protect_posted_wallet_ledger_entries();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_wallet_ledger_entry_account_currency BEFORE INSERT OR UPDATE ON wallet_ledger_entries FOR EACH ROW EXECUTE FUNCTION enforce_wallet_ledger_entry_account_currency();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_entries
          ADD CONSTRAINT wallet_ledger_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES wallet_ledger_accounts(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_entries
          ADD CONSTRAINT wallet_ledger_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_ledger_entries',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_ledger_entries because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_ledger_entries";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_wallet_ledger_entry_account_currency();`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS protect_posted_wallet_ledger_entries();`);
  }
}
