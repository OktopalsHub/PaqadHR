import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSubscriptionBillingProvider1783369099246 implements MigrationInterface {
  name = 'TenantSubscriptionBillingProvider1783369099246';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(16) NOT NULL DEFAULT 'nomba',
        ADD COLUMN IF NOT EXISTS noah_customer_id VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        DROP COLUMN IF EXISTS noah_customer_id,
        DROP COLUMN IF EXISTS billing_provider;
    `);
  }
}
