import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsSetup1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_wallets (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        currency_code VARCHAR(8) DEFAULT 'NGN',
        balance_amount NUMERIC(14,2) DEFAULT 0,
        virtual_account_number VARCHAR,
        virtual_account_bank VARCHAR,
        points_exchange_rate NUMERIC(10,2) DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenant_wallets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE (tenant_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_wallet_transactions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_wallet_id UUID NOT NULL,
        type VARCHAR(16) NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        reference VARCHAR UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (tenant_wallet_id) REFERENCES tenant_wallets(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS custom_rewards (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT,
        points_cost INTEGER NOT NULL,
        image_url VARCHAR,
        is_active BOOLEAN DEFAULT TRUE,
        stock_limit INTEGER,
        delivery_instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_custom_rewards_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reward_redemptions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        member_id UUID NOT NULL,
        reward_type VARCHAR(24) NOT NULL,
        reward_id VARCHAR,
        reward_name VARCHAR,
        points_spent INTEGER NOT NULL,
        currency_value NUMERIC(14,2) NOT NULL,
        currency_code VARCHAR(8) DEFAULT 'NGN',
        status VARCHAR(16) DEFAULT 'PENDING',
        recipient_email VARCHAR,
        recipient_phone VARCHAR,
        voucher_code TEXT,
        voucher_pin TEXT,
        voucher_instructions TEXT,
        provider_tx_ref VARCHAR,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_reward_redemptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_reward_redemptions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_wallets_tenant_id ON tenant_wallets(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON tenant_wallet_transactions(tenant_wallet_id);
      CREATE INDEX IF NOT EXISTS idx_custom_rewards_tenant_id ON custom_rewards(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_reward_redemptions_tenant_id ON reward_redemptions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_reward_redemptions_member_id ON reward_redemptions(member_id);
      CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status ON reward_redemptions(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS reward_redemptions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS custom_rewards;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_wallet_transactions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_wallets;`);
  }
}
