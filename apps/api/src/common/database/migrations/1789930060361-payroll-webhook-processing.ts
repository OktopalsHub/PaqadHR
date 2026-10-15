import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollWebhookEventProcessing1789930060361 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE payroll_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE payroll_webhook_events DROP COLUMN IF EXISTS processed_at;',
    );
  }
}
