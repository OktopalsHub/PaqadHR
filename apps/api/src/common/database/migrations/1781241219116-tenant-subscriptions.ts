import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSubscriptions1781241219116 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_subscriptions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        plan_id UUID NOT NULL,
        plan_price_id UUID NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'TRIAL',
        current_users INTEGER NOT NULL DEFAULT 0,
        trial_ends_at TIMESTAMP,
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        next_billing_date TIMESTAMP NOT NULL,
        nomba_subscription_id VARCHAR(100),
        payment_method_id VARCHAR(100),
        usage_metrics JSONB,
        billing_history JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenant_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_tenant_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT,
        CONSTRAINT fk_tenant_subscriptions_plan_price FOREIGN KEY (plan_price_id) REFERENCES plan_prices(id) ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenant_subscriptions;`);
  }
}
