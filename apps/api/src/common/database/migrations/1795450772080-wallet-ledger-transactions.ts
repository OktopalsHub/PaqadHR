import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletLedgerTransactions1795450772080 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_ledger_transactions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          kind character varying(32) NOT NULL,
          status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
          idempotency_key character varying(255) NOT NULL,
          provider character varying(24),
          provider_reference character varying(255),
          reverses_transaction_id uuid,
          occurred_at timestamp without time zone,
          evidence jsonb,
          CONSTRAINT wallet_ledger_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'posted'::character varying, 'reversed'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_transactions
          ADD CONSTRAINT wallet_ledger_transactions_idempotency_key_key UNIQUE (idempotency_key);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_transactions
          ADD CONSTRAINT wallet_ledger_transactions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_wallet_ledger_transactions_provider_ref ON wallet_ledger_transactions USING btree (provider, provider_reference) WHERE ((provider IS NOT NULL) AND (provider_reference IS NOT NULL));
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_wallet_ledger_transaction_balance()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            DECLARE bad_currency_count integer;
            entry_count integer;
            BEGIN
              IF NEW.status NOT IN ('posted', 'reversed') THEN RETURN NEW; END IF;
              SELECT COUNT(*) INTO entry_count FROM wallet_ledger_entries WHERE transaction_id = NEW.id;
              IF entry_count < 2 THEN
                RAISE EXCEPTION 'A posted wallet ledger transaction requires at least two entries';
              END IF;
              SELECT COUNT(*) INTO bad_currency_count
              FROM (
                SELECT currency
                FROM wallet_ledger_entries
                WHERE transaction_id = NEW.id
                GROUP BY currency
                HAVING SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END) <> 0
              ) unbalanced;
              IF bad_currency_count > 0 THEN
                RAISE EXCEPTION 'Wallet ledger transaction must balance separately for each currency';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_posted_wallet_ledger_transaction()
       RETURNS trigger
       LANGUAGE plpgsql
      AS $function$
            BEGIN
              IF TG_OP = 'DELETE' THEN
                IF OLD.status IN ('posted', 'reversed') THEN
                  RAISE EXCEPTION 'Posted wallet ledger transaction evidence is immutable';
                END IF;
                RETURN OLD;
              END IF;
              IF OLD.status = 'reversed' THEN
                RAISE EXCEPTION 'Reversed wallet ledger transactions are immutable';
              END IF;
              IF OLD.status = 'posted' AND (
                NEW.kind IS DISTINCT FROM OLD.kind OR
                NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
                NEW.provider IS DISTINCT FROM OLD.provider OR
                NEW.provider_reference IS DISTINCT FROM OLD.provider_reference OR
                NEW.reverses_transaction_id IS DISTINCT FROM OLD.reverses_transaction_id OR
                NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR
                NEW.evidence IS DISTINCT FROM OLD.evidence OR
                NEW.status NOT IN ('posted', 'reversed')
              ) THEN
                RAISE EXCEPTION 'Posted wallet ledger transaction evidence is immutable';
              END IF;
              RETURN NEW;
            END;
            $function$;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_enforce_wallet_ledger_transaction_balance AFTER INSERT OR UPDATE ON wallet_ledger_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_wallet_ledger_transaction_balance();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_protect_posted_wallet_ledger_transaction BEFORE DELETE OR UPDATE ON wallet_ledger_transactions FOR EACH ROW EXECUTE FUNCTION protect_posted_wallet_ledger_transaction();
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_ledger_transactions
          ADD CONSTRAINT wallet_ledger_transactions_reverses_transaction_id_fkey FOREIGN KEY (reverses_transaction_id) REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_ledger_transactions',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_ledger_transactions because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_ledger_transactions";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_wallet_ledger_transaction_balance();`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS protect_posted_wallet_ledger_transaction();`);
  }
}
