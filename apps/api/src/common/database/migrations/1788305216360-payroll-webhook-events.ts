import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollWebhookEvents1788305216360 implements MigrationInterface {
  name = 'PayrollWebhookEvents1788305216360';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_webhook_events (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        provider varchar(32) NOT NULL,
        event_id varchar(255) NOT NULL,
        received_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT pk_payroll_webhook_events PRIMARY KEY (id),
        CONSTRAINT uk_payroll_webhook_events_provider_event UNIQUE (provider, event_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS payroll_webhook_events');
  }
}
