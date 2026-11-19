import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletFundings1793300000000 implements MigrationInterface {
  name = 'WalletFundings1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_fundings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        owner_type varchar(16) NOT NULL CHECK (owner_type IN ('organization', 'employee')),
        tenant_id uuid NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        user_id uuid NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        virtual_account_id uuid NOT NULL REFERENCES provider_virtual_accounts(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL,
        provider_deposit_id varchar(255) NOT NULL,
        status varchar(24) NOT NULL CHECK (status IN (
          'funds_received', 'in_review', 'payment_submitted', 'payment_processed',
          'refund_in_flight', 'refunded', 'refund_failed', 'unknown'
        )),
        source_amount numeric(30, 12) NULL CHECK (source_amount IS NULL OR source_amount > 0),
        source_currency varchar(10) NOT NULL,
        destination_amount numeric(30, 12) NULL CHECK (destination_amount IS NULL OR destination_amount > 0),
        destination_currency varchar(10) NOT NULL,
        network varchar(32) NOT NULL,
        occurred_at timestamp NOT NULL,
        ledger_transaction_id uuid NULL REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT,
        reversal_transaction_id uuid NULL REFERENCES wallet_ledger_transactions(id) ON DELETE RESTRICT,
        CONSTRAINT ck_wallet_fundings_owner CHECK (
          (owner_type = 'organization' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
          (owner_type = 'employee' AND user_id IS NOT NULL AND tenant_id IS NULL)
        ),
        CONSTRAINT uq_wallet_fundings_provider_deposit UNIQUE
          (provider, virtual_account_id, provider_deposit_id)
      );
      CREATE INDEX ix_wallet_fundings_org_created
        ON wallet_fundings (tenant_id, created_at) WHERE owner_type = 'organization';
      CREATE INDEX ix_wallet_fundings_employee_created
        ON wallet_fundings (user_id, created_at) WHERE owner_type = 'employee';

      CREATE FUNCTION enforce_wallet_funding_virtual_account_owner()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_wallet_funding_virtual_account_owner
        BEFORE INSERT OR UPDATE ON wallet_fundings
        FOR EACH ROW EXECUTE FUNCTION enforce_wallet_funding_virtual_account_owner();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_fundings',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error('Refusing to drop populated wallet funding records.');
    }
    await queryRunner.query('DROP TABLE wallet_fundings');
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS enforce_wallet_funding_virtual_account_owner()',
    );
  }
}
