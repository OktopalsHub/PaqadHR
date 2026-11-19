import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustodyWalletLedger1793000000000 implements MigrationInterface {
  name = 'CustodyWalletLedger1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_provider_customers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        owner_type varchar(16) NOT NULL CHECK (owner_type IN ('organization', 'employee')),
        tenant_id uuid NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        user_id uuid NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL,
        provider_customer_id varchar(255) NULL,
        provider_kyc_link_id varchar(255) NULL,
        status varchar(24) NOT NULL DEFAULT 'pending',
        kyc_status varchar(24) NULL,
        kyb_status varchar(24) NULL,
        terms_status varchar(24) NULL,
        metadata jsonb NULL,
        CONSTRAINT ck_wallet_provider_customers_owner CHECK (
          (owner_type = 'organization' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
          (owner_type = 'employee' AND user_id IS NOT NULL AND tenant_id IS NULL)
        ),
        CONSTRAINT uq_wallet_provider_customers_provider_customer UNIQUE (provider, provider_customer_id),
        CONSTRAINT uq_wallet_provider_customers_kyc_link UNIQUE (provider, provider_kyc_link_id)
      );
      CREATE UNIQUE INDEX uq_wallet_provider_customers_org_provider
        ON wallet_provider_customers (tenant_id, provider) WHERE owner_type = 'organization';
      CREATE UNIQUE INDEX uq_wallet_provider_customers_employee_provider
        ON wallet_provider_customers (user_id, provider) WHERE owner_type = 'employee';

      CREATE TABLE custody_wallets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        owner_type varchar(16) NOT NULL CHECK (owner_type IN ('organization', 'employee')),
        tenant_id uuid NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        user_id uuid NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        provider_customer_id uuid NOT NULL REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL,
        provider_wallet_id varchar(255) NOT NULL,
        network varchar(32) NOT NULL,
        address varchar(255) NULL,
        status varchar(24) NOT NULL DEFAULT 'pending',
        metadata jsonb NULL,
        CONSTRAINT ck_custody_wallets_owner CHECK (
          (owner_type = 'organization' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
          (owner_type = 'employee' AND user_id IS NOT NULL AND tenant_id IS NULL)
        ),
        CONSTRAINT uq_custody_wallets_provider_wallet UNIQUE (provider, provider_wallet_id)
      );
      CREATE UNIQUE INDEX uq_custody_wallets_org_chain
        ON custody_wallets (tenant_id, provider, network) WHERE owner_type = 'organization';
      CREATE UNIQUE INDEX uq_custody_wallets_employee_chain
        ON custody_wallets (user_id, provider, network) WHERE owner_type = 'employee';
      CREATE INDEX ix_custody_wallets_org ON custody_wallets (tenant_id, created_at) WHERE owner_type = 'organization';
      CREATE INDEX ix_custody_wallets_employee ON custody_wallets (user_id, created_at) WHERE owner_type = 'employee';

      CREATE FUNCTION enforce_custody_wallet_customer_owner()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_custody_wallet_customer_owner
        BEFORE INSERT OR UPDATE ON custody_wallets
        FOR EACH ROW EXECUTE FUNCTION enforce_custody_wallet_customer_owner();

      CREATE TABLE wallet_ledger_accounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        owner_type varchar(16) NOT NULL CHECK (owner_type IN ('organization', 'employee', 'system')),
        tenant_id uuid NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        user_id uuid NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        account_type varchar(24) NOT NULL CHECK (account_type IN ('available', 'reserved', 'clearing', 'fee', 'custody', 'revenue')),
        normal_side varchar(6) NOT NULL CHECK (normal_side IN ('debit', 'credit')),
        currency varchar(10) NOT NULL,
        network varchar(32) NULL,
        status varchar(16) NOT NULL DEFAULT 'active',
        CONSTRAINT ck_wallet_ledger_accounts_owner CHECK (
          (owner_type = 'organization' AND tenant_id IS NOT NULL AND user_id IS NULL AND account_type IN ('available', 'reserved')) OR
          (owner_type = 'employee' AND user_id IS NOT NULL AND tenant_id IS NULL AND account_type IN ('available', 'reserved')) OR
          (owner_type = 'system' AND tenant_id IS NULL AND user_id IS NULL AND account_type IN ('clearing', 'fee', 'custody', 'revenue'))
        ),
        CONSTRAINT ck_wallet_ledger_accounts_normal_side CHECK (
          owner_type = 'system' OR normal_side = 'credit'
        )
      );
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_org
        ON wallet_ledger_accounts (tenant_id, account_type, currency, COALESCE(network, '')) WHERE owner_type = 'organization';
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_employee
        ON wallet_ledger_accounts (user_id, account_type, currency, COALESCE(network, '')) WHERE owner_type = 'employee';
      CREATE UNIQUE INDEX uq_wallet_ledger_accounts_system
        ON wallet_ledger_accounts (account_type, currency, COALESCE(network, '')) WHERE owner_type = 'system';

      CREATE TABLE wallet_ledger_transactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        kind varchar(32) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'reversed')),
        idempotency_key varchar(255) NOT NULL UNIQUE,
        provider varchar(24) NULL,
        provider_reference varchar(255) NULL,
        reverses_transaction_id uuid NULL REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT,
        occurred_at timestamp NULL,
        evidence jsonb NULL
      );
      CREATE UNIQUE INDEX uq_wallet_ledger_transactions_provider_ref
        ON wallet_ledger_transactions (provider, provider_reference)
        WHERE provider IS NOT NULL AND provider_reference IS NOT NULL;

      CREATE TABLE wallet_ledger_entries (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        transaction_id uuid NOT NULL REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT,
        account_id uuid NOT NULL REFERENCES wallet_ledger_accounts(id) ON DELETE RESTRICT,
        direction varchar(6) NOT NULL CHECK (direction IN ('debit', 'credit')),
        amount numeric(30, 12) NOT NULL CHECK (amount > 0),
        currency varchar(10) NOT NULL
      );
      CREATE INDEX ix_wallet_ledger_entries_account_created
        ON wallet_ledger_entries (account_id, created_at);
      CREATE INDEX ix_wallet_ledger_entries_transaction ON wallet_ledger_entries (transaction_id);

      CREATE FUNCTION protect_referenced_wallet_ledger_accounts()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_protect_referenced_wallet_ledger_accounts
        BEFORE UPDATE OR DELETE ON wallet_ledger_accounts
        FOR EACH ROW EXECUTE FUNCTION protect_referenced_wallet_ledger_accounts();

      CREATE FUNCTION enforce_wallet_ledger_entry_account_currency()
      RETURNS trigger AS $$
      DECLARE account_currency varchar(10);
      BEGIN
        SELECT currency INTO account_currency FROM wallet_ledger_accounts WHERE id = NEW.account_id;
        IF account_currency IS NULL OR account_currency <> NEW.currency THEN
          RAISE EXCEPTION 'Wallet ledger entry currency must match its account';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_wallet_ledger_entry_account_currency
        BEFORE INSERT OR UPDATE ON wallet_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION enforce_wallet_ledger_entry_account_currency();

      CREATE FUNCTION protect_posted_wallet_ledger_entries()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_protect_posted_wallet_ledger_entries
        BEFORE INSERT OR UPDATE OR DELETE ON wallet_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION protect_posted_wallet_ledger_entries();

      CREATE FUNCTION enforce_wallet_ledger_transaction_balance()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE CONSTRAINT TRIGGER trg_enforce_wallet_ledger_transaction_balance
        AFTER INSERT OR UPDATE ON wallet_ledger_transactions
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION enforce_wallet_ledger_transaction_balance();

      CREATE FUNCTION protect_posted_wallet_ledger_transaction()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_protect_posted_wallet_ledger_transaction
        BEFORE UPDATE OR DELETE ON wallet_ledger_transactions
        FOR EACH ROW EXECUTE FUNCTION protect_posted_wallet_ledger_transaction();

      CREATE TABLE wallet_operations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        payroll_run_id uuid NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
        payroll_item_id uuid NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
        source_wallet_id uuid NULL REFERENCES custody_wallets(id) ON DELETE RESTRICT,
        destination_wallet_id uuid NULL REFERENCES custody_wallets(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL,
        kind varchar(24) NOT NULL CHECK (kind IN ('funding', 'transfer', 'withdrawal', 'conversion')),
        status varchar(24) NOT NULL DEFAULT 'created',
        source_amount numeric(30, 12) NOT NULL CHECK (source_amount > 0),
        source_currency varchar(10) NOT NULL,
        destination_amount numeric(30, 12) NULL CHECK (destination_amount IS NULL OR destination_amount > 0),
        destination_currency varchar(10) NULL,
        network varchar(32) NULL,
        exchange_rate numeric(30, 12) NULL CHECK (exchange_rate IS NULL OR exchange_rate > 0),
        provider_reference varchar(255) NULL,
        idempotency_key varchar(255) NOT NULL UNIQUE,
        metadata jsonb NULL
      );
      CREATE UNIQUE INDEX uq_wallet_operations_provider_ref
        ON wallet_operations (provider, provider_reference)
        WHERE provider_reference IS NOT NULL;
      CREATE INDEX ix_wallet_operations_tenant_created ON wallet_operations (tenant_id, created_at);
      CREATE INDEX ix_wallet_operations_payroll_run ON wallet_operations (payroll_run_id, created_at)
        WHERE payroll_run_id IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'wallet_operations',
      'wallet_ledger_entries',
      'wallet_ledger_transactions',
      'wallet_ledger_accounts',
      'custody_wallets',
      'wallet_provider_customers',
    ];
    const [{ count }] = (await queryRunner.query(
      `SELECT (
        (SELECT COUNT(*) FROM wallet_operations) +
        (SELECT COUNT(*) FROM wallet_ledger_entries) +
        (SELECT COUNT(*) FROM wallet_ledger_transactions) +
        (SELECT COUNT(*) FROM wallet_ledger_accounts) +
        (SELECT COUNT(*) FROM custody_wallets) +
        (SELECT COUNT(*) FROM wallet_provider_customers)
      )::text AS count`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop populated wallet or financial ledger tables. Archive and reconcile them first.',
      );
    }
    for (const table of tables) await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS enforce_wallet_ledger_entry_account_currency();
      DROP FUNCTION IF EXISTS enforce_custody_wallet_customer_owner();
      DROP FUNCTION IF EXISTS protect_referenced_wallet_ledger_accounts();
      DROP FUNCTION IF EXISTS protect_posted_wallet_ledger_entries();
      DROP FUNCTION IF EXISTS enforce_wallet_ledger_transaction_balance();
      DROP FUNCTION IF EXISTS protect_posted_wallet_ledger_transaction();
    `);
  }
}
