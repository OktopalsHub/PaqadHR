import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderVirtualAccounts1793100000000 implements MigrationInterface {
  name = 'ProviderVirtualAccounts1793100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE provider_virtual_accounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        owner_type varchar(16) NOT NULL CHECK (owner_type IN ('organization', 'employee')),
        tenant_id uuid NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        user_id uuid NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        provider_customer_id uuid NOT NULL REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT,
        custody_wallet_id uuid NOT NULL REFERENCES custody_wallets(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL,
        provider_virtual_account_id varchar(255) NOT NULL,
        source_currency varchar(10) NOT NULL CHECK (source_currency IN ('USD', 'EUR', 'GBP', 'NGN')),
        destination_currency varchar(10) NOT NULL CHECK (destination_currency IN ('USDC', 'USDT')),
        network varchar(32) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'pending',
        CONSTRAINT ck_provider_virtual_accounts_owner CHECK (
          (owner_type = 'organization' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
          (owner_type = 'employee' AND user_id IS NOT NULL AND tenant_id IS NULL)
        ),
        CONSTRAINT uq_provider_virtual_accounts_route UNIQUE
          (provider_customer_id, source_currency, destination_currency, network),
        CONSTRAINT uq_provider_virtual_accounts_provider_id UNIQUE
          (provider, provider_virtual_account_id)
      );
      CREATE INDEX ix_provider_virtual_accounts_org
        ON provider_virtual_accounts (tenant_id, created_at) WHERE owner_type = 'organization';
      CREATE INDEX ix_provider_virtual_accounts_employee
        ON provider_virtual_accounts (user_id, created_at) WHERE owner_type = 'employee';

      CREATE FUNCTION enforce_provider_virtual_account_ownership()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_provider_virtual_account_ownership
        BEFORE INSERT OR UPDATE ON provider_virtual_accounts
        FOR EACH ROW EXECUTE FUNCTION enforce_provider_virtual_account_ownership();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM provider_virtual_accounts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error('Refusing to drop populated provider virtual account records.');
    }
    await queryRunner.query('DROP TABLE provider_virtual_accounts');
    await queryRunner.query('DROP FUNCTION IF EXISTS enforce_provider_virtual_account_ownership()');
  }
}
