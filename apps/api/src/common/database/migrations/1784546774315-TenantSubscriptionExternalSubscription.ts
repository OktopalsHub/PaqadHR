import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSubscriptionExternalSubscription1784546774315 implements MigrationInterface {
  name = 'TenantSubscriptionExternalSubscription1784546774315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS external_subscription_id VARCHAR(100) NULL,
        ALTER COLUMN billing_provider TYPE VARCHAR(16);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        DROP COLUMN IF EXISTS external_subscription_id;
    `);
  }
}
