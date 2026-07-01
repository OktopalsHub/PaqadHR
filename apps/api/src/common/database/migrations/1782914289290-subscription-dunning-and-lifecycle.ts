import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionDunningAndLifecycle1782914289290 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS dunning_attempt_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS dunning_next_retry_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_payment_failure_reason VARCHAR,
        ADD COLUMN IF NOT EXISTS last_payment_failure_detail TEXT,
        ADD COLUMN IF NOT EXISTS payment_method_brand VARCHAR,
        ADD COLUMN IF NOT EXISTS payment_method_last_four VARCHAR(4);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        DROP COLUMN IF EXISTS payment_method_last_four,
        DROP COLUMN IF EXISTS payment_method_brand,
        DROP COLUMN IF EXISTS last_payment_failure_detail,
        DROP COLUMN IF EXISTS last_payment_failure_reason,
        DROP COLUMN IF EXISTS dunning_next_retry_at,
        DROP COLUMN IF EXISTS dunning_attempt_count,
        DROP COLUMN IF EXISTS paused_at,
        DROP COLUMN IF EXISTS cancellation_reason,
        DROP COLUMN IF EXISTS cancelled_at,
        DROP COLUMN IF EXISTS cancel_at_period_end;
    `);
  }
}
