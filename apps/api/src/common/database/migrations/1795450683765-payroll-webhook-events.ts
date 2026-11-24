import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollWebhookEvents1795450683765 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_webhook_events (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          provider character varying(32) NOT NULL,
          event_id character varying(255) NOT NULL,
          received_at timestamp without time zone DEFAULT now() NOT NULL,
          processed_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_webhook_events
          ADD CONSTRAINT pk_payroll_webhook_events PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_webhook_events
          ADD CONSTRAINT uk_payroll_webhook_events_provider_event UNIQUE (provider, event_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_webhook_events";`);
  }
}
