import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BridgeExternalAccounts1793500000000 implements MigrationInterface {
  name = 'BridgeExternalAccounts1793500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_payment_methods_owner_reference
        ON payment_methods (id, tenant_id, member_id);
      CREATE TABLE provider_external_accounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        member_id uuid NOT NULL REFERENCES tenant_members(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        payment_method_id uuid NOT NULL,
        provider_customer_id uuid NOT NULL REFERENCES wallet_provider_customers(id) ON DELETE RESTRICT,
        provider varchar(24) NOT NULL CHECK (provider = 'bridge'),
        provider_external_account_id varchar(255) NOT NULL,
        currency varchar(10) NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP')),
        country varchar(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
        source_currency varchar(10) NOT NULL CHECK (source_currency IN ('USDC', 'USDT')),
        network varchar(32) NOT NULL,
        status varchar(24) NOT NULL CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
        fingerprint varchar(64) NOT NULL,
        CONSTRAINT uq_provider_external_accounts_method UNIQUE (payment_method_id),
        CONSTRAINT uq_provider_external_accounts_provider_id UNIQUE
          (provider, provider_external_account_id),
        CONSTRAINT fk_provider_external_accounts_method_owner
          FOREIGN KEY (payment_method_id, tenant_id, member_id)
          REFERENCES payment_methods(id, tenant_id, member_id) ON DELETE RESTRICT
      );
      CREATE INDEX ix_provider_external_accounts_owner
        ON provider_external_accounts (tenant_id, user_id, currency);
      CREATE FUNCTION enforce_bridge_external_account_owner()
      RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_bridge_external_account_owner
        BEFORE INSERT OR UPDATE ON provider_external_accounts
        FOR EACH ROW EXECUTE FUNCTION enforce_bridge_external_account_owner();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM provider_external_accounts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error('Refusing to drop populated Bridge external account mappings.');
    }
    await queryRunner.query('DROP TABLE provider_external_accounts');
    await queryRunner.query('DROP FUNCTION IF EXISTS enforce_bridge_external_account_owner()');
    await queryRunner.query('DROP INDEX IF EXISTS uq_payment_methods_owner_reference');
  }
}
