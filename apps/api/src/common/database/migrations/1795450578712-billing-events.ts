import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingEvents1795450578712 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE billing_events (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          event_id character varying(255) NOT NULL,
          provider character varying(32) NOT NULL,
          event_type character varying(100) NOT NULL,
          payload jsonb,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY billing_events
          ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_billing_events_created_at ON billing_events USING btree (created_at DESC);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_billing_events_event_provider ON billing_events USING btree (event_id, provider);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_events";`);
  }
}
